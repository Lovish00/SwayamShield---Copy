import { loadEnv } from './env.js';

loadEnv();

const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
const model = 'gemini-2.0-flash';

if (!apiKey) {
  console.error('[Gemini Check] Missing GEMINI_API_KEY in server/.env');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with one word: ok' }] }],
    }),
    signal: controller.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[Gemini Check] FAILED');
    console.error('Status:', res.status);
    console.error('Error:', err?.error?.message || err?.message || 'Unknown error');
    process.exit(1);
  }

  const data = await res.json();
  const output = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('[Gemini Check] SUCCESS');
  console.log('Model:', model);
  console.log('Response preview:', output.slice(0, 120));
} catch (err) {
  console.error('[Gemini Check] FAILED');
  console.error('Reason:', err?.cause?.code || err?.code || err?.name || err?.message);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}

