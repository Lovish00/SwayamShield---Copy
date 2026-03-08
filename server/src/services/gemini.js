import { loadEnv } from '../config/env.js';

loadEnv();

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_TIMEOUT_MS = 15000;

const SYSTEM_PROMPT = `You are SwayamShield AI Health Assistant, a medical symptom analysis tool. Your role is to:

1. Ask relevant follow-up questions to understand the patient's symptoms
2. Provide possible conditions based on reported symptoms
3. Recommend appropriate medical specialties to consult
4. ALWAYS emphasize that this is NOT a substitute for professional medical advice
5. For potentially serious symptoms (chest pain, difficulty breathing, severe bleeding), immediately recommend emergency services (112)

Guidelines:
- Be empathetic and professional
- Ask about severity (1-10), duration, location, and associated symptoms
- Consider common conditions first
- Never diagnose definitively, suggest possibilities
- Always recommend seeing a qualified doctor
- Use bullet points and formatting for clarity
- Keep responses concise but informative
- If symptoms suggest emergency, start with "WARNING" and recommend calling 112`;

function getApiKey() {
  const raw = (process.env.GEMINI_API_KEY || '').trim();
  if (!raw) return '';
  // Handle accidental wrapping quotes in .env values.
  return raw.replace(/^['"]|['"]$/g, '').trim();
}

function mapGeminiHttpError(status, message) {
  const msg = (message || '').toLowerCase();

  if (status === 429 || msg.includes('quota') || msg.includes('resource_exhausted')) {
    return 'Gemini quota exceeded for this API key/project. Enable billing or use a key/project with available quota.';
  }
  if (status === 400 && msg.includes('api key')) {
    return 'Gemini API key is invalid. Generate a new key from Google AI Studio and update server/.env.';
  }
  if (status === 403) {
    return 'Gemini request was forbidden. Ensure Generative Language API is enabled for this key and unrestricted for your backend IP.';
  }
  if (status === 404 || msg.includes('model')) {
    return 'Gemini model is unavailable for this key. Try model "gemini-1.5-flash" or re-check API access.';
  }

  return `Gemini API error (${status}). ${message || 'Unknown error'}`;
}

function mapNetworkError(err) {
  const code = err?.cause?.code || err?.code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'Cannot resolve Gemini host. Check internet/DNS settings on the server machine.';
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT') {
    return 'Cannot reach Gemini service. Check internet connectivity, firewall, or proxy settings.';
  }
  if (code === 'EACCES') {
    return 'Network access to Gemini is blocked by OS or firewall policy.';
  }
  if (err?.name === 'AbortError') {
    return 'Gemini request timed out. Please retry.';
  }

  return err?.message || 'Unknown network error while contacting Gemini.';
}

export async function analyzeSymptoms(messages) {
  const apiKey = getApiKey();

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    return {
      response: 'Gemini API key is not configured. Add GEMINI_API_KEY in server/.env and restart the backend server.',
      demo: true,
      error: true,
      reason: 'missing_api_key',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const contents = [
      ...messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      const apiMessage =
        errorData?.error?.message ||
        errorData?.message ||
        'No additional error details returned.';
      const mapped = mapGeminiHttpError(response.status, apiMessage);
      return {
        response: `AI service is unavailable right now. ${mapped}`,
        demo: false,
        error: true,
        reason: 'gemini_http_error',
      };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to analyze symptoms at the moment.';

    return { response: text, demo: false };
  } catch (err) {
    console.error('Gemini service error:', err);
    const mapped = mapNetworkError(err);
    return {
      response: `AI service connection failed. ${mapped}`,
      demo: false,
      error: true,
      reason: 'gemini_network_error',
    };
  } finally {
    clearTimeout(timeout);
  }
}
