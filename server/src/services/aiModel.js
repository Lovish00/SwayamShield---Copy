import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { loadEnv } from '../config/env.js';

loadEnv();

const AI_MODEL_BASE_URL = (process.env.AI_MODEL_BASE_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 12000;
const HEALTH_TIMEOUT_MS = 2500;
const STARTUP_WAIT_MS = 20000;
const SYMPTOM_CACHE_TTL_MS = 5 * 60 * 1000;

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const baseUrl = new URL(AI_MODEL_BASE_URL);
const isLocalModelService = LOCAL_HOSTS.has(baseUrl.hostname);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
const aiModelDir = path.join(projectRoot, 'ai-model');
const aiModelApiPath = path.join(aiModelDir, 'api.py');

let symptomCache = {
  items: null,
  fetchedAt: 0,
};

let modelBootPromise = null;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueNormalizedSymptoms(symptoms) {
  const seen = new Set();
  const result = [];

  for (const item of symptoms || []) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConnectionError(err) {
  const code = err?.cause?.code || err?.code;
  return ['ECONNREFUSED', 'EACCES', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(code);
}

function resolvePythonExecutable() {
  const custom = (process.env.AI_MODEL_PYTHON || '').trim();
  if (custom) return custom;

  const windowsVenv = path.join(aiModelDir, 'venv', 'Scripts', 'python.exe');
  if (fs.existsSync(windowsVenv)) return windowsVenv;

  const unixVenv = path.join(aiModelDir, 'venv', 'bin', 'python');
  if (fs.existsSync(unixVenv)) return unixVenv;

  return process.platform === 'win32' ? 'python' : 'python3';
}

async function pingModelHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(`${AI_MODEL_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function startLocalModelService() {
  if (!fs.existsSync(aiModelApiPath)) {
    throw new Error(`Local model api.py not found at ${aiModelApiPath}`);
  }

  const pythonExecutable = resolvePythonExecutable();

  const child = spawn(pythonExecutable, [aiModelApiPath], {
    cwd: aiModelDir,
    env: {
      ...process.env,
      PYTHONUTF8: '1',
    },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  child.unref();
}

async function ensureModelApiRunning() {
  if (!isLocalModelService) return;

  if (await pingModelHealth()) return;

  if (!modelBootPromise) {
    modelBootPromise = (async () => {
      startLocalModelService();

      const deadline = Date.now() + STARTUP_WAIT_MS;
      while (Date.now() < deadline) {
        if (await pingModelHealth()) return;
        await wait(1000);
      }

      throw new Error(
        `Local AI model service did not become healthy at ${AI_MODEL_BASE_URL} within ${STARTUP_WAIT_MS / 1000}s`
      );
    })().finally(() => {
      modelBootPromise = null;
    });
  }

  return modelBootPromise;
}

async function fetchJson(url, options = {}, allowRetry = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI model API ${response.status}: ${body || 'request failed'}`);
    }

    return response.json();
  } catch (err) {
    if (allowRetry && isLocalModelService && isConnectionError(err)) {
      await ensureModelApiRunning();
      return fetchJson(url, options, false);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getModelSymptoms() {
  await ensureModelApiRunning();

  const now = Date.now();
  if (symptomCache.items && now - symptomCache.fetchedAt < SYMPTOM_CACHE_TTL_MS) {
    return symptomCache.items;
  }

  const payload = await fetchJson(`${AI_MODEL_BASE_URL}/symptoms`);
  const list = Array.isArray(payload?.symptoms) ? payload.symptoms : [];
  const normalized = uniqueNormalizedSymptoms(list);

  symptomCache = {
    items: normalized,
    fetchedAt: now,
  };

  return normalized;
}

export async function predictWithModel(symptoms) {
  await ensureModelApiRunning();

  const normalizedSymptoms = uniqueNormalizedSymptoms(symptoms);
  if (normalizedSymptoms.length === 0) {
    return {
      predictions: [],
      matched_symptoms: [],
      symptoms_matched: 0,
      total_symptoms: 0,
      message: 'No symptoms provided',
    };
  }

  return fetchJson(`${AI_MODEL_BASE_URL}/predict`, {
    method: 'POST',
    body: JSON.stringify({ symptoms: normalizedSymptoms }),
  });
}

export async function extractSymptomsFromText(text) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];

  const vocabulary = await getModelSymptoms();
  const matches = [];

  for (const symptom of vocabulary) {
    if (normalizedText.includes(symptom)) {
      matches.push(symptom);
    }
    if (matches.length >= 12) break;
  }

  return uniqueNormalizedSymptoms(matches);
}

export function getModelBaseUrl() {
  return AI_MODEL_BASE_URL;
}
