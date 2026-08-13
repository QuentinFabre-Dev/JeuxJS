/**
 * Ollama runtime configuration.
 *
 * By default the app talks to Ollama through the Vite dev proxy (`/ollama`),
 * which avoids any CORS setup: the browser calls the app's own origin and
 * Vite forwards the request to the Ollama server (see vite.config.js).
 *
 * The user can override the endpoint and the model from the settings dialog;
 * the choice is persisted in localStorage.
 */

const STORAGE_KEY = 'ryder.ollama.settings';

// `import.meta.env` only exists under Vite; guarding it keeps these modules
// importable from plain Node (tests, scripts).
const env = import.meta.env ?? {};

export const PROXY_BASE_URL = '/ollama';

export const DEFAULT_SETTINGS = {
  // '/ollama' → Vite proxy. Any absolute URL → direct call (needs OLLAMA_ORIGINS).
  baseUrl: env.VITE_OLLAMA_BASE_URL || PROXY_BASE_URL,
  model: env.VITE_OLLAMA_MODEL || 'llama3.1:8b',
  temperature: 0.2,
  numCtx: 8192,
  // Number of document pages sent to the model in a single request.
  pagesPerBatch: 2,
  // 'ollama' runs the real local model, 'demo' replays the mocked findings.
  engine: 'ollama',
};

export const loadSettings = () => {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode): settings stay in memory only */
  }
};

/** Normalises a base URL: no trailing slash, proxy path kept as-is. */
export const normaliseBaseUrl = (value) => {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return PROXY_BASE_URL;
  if (trimmed.startsWith('/')) return trimmed;
  return /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
};

export const isProxied = (baseUrl) => baseUrl.startsWith('/');
