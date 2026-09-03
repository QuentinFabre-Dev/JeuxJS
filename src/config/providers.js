/**
 * Model providers and their runtime settings.
 *
 * Two providers can run the analysis:
 *
 * - **Ollama**, on this machine. Nothing leaves the computer.
 * - **DeepSeek**, a cloud API. Used as a fallback when the local model is not
 *   available or not good enough — at the cost of sending the document text to
 *   a third party.
 *
 * Both are reached through a Vite proxy (`/ollama`, `/deepseek`), never
 * directly: for DeepSeek that keeps the API key inside the Node process — a key
 * exposed to the browser would be public — and it also sidesteps CORS, which
 * OpenAI-compatible APIs do not open to browsers.
 */

const STORAGE_KEY = 'ryder.provider.settings';

// Next inlines `process.env.NEXT_PUBLIC_*` at build time; the guard keeps
// these modules importable from plain Node (tests, scripts).
const env = typeof process === 'undefined' ? {} : (process.env ?? {});

export const PROXY_BASE_URL = '/ollama';
export const DEEPSEEK_BASE_URL = '/deepseek';

export const PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI (cloud)',
    kind: 'cloud',
    // Reviews run on the server, through /api/analyze: the browser never holds
    // a key and never talks to OpenAI directly.
    baseUrl: '/api/analyze',
    defaultModel: 'gpt-5',
    // A fixed catalogue with no listing endpoint of its own: the tiers are
    // chosen per check, not per review, so there is nothing to enumerate.
    catalogueOnly: true,
    knownModels: ['gpt-5'],
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'local',
    baseUrl: PROXY_BASE_URL,
    defaultModel: 'llama3.1:8b',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek (cloud)',
    kind: 'cloud',
    baseUrl: DEEPSEEK_BASE_URL,
    defaultModel: 'deepseek-chat',
    // Listed for the dropdown when the API cannot be reached to enumerate them.
    knownModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  demo: {
    id: 'demo',
    label: 'Demo data',
    kind: 'demo',
    defaultModel: null,
  },
};

export const isCloudProvider = (engine) => PROVIDERS[engine]?.kind === 'cloud';

export const DEFAULT_SETTINGS = {
  // '/ollama' → Vite proxy. Any absolute URL → direct call (needs OLLAMA_ORIGINS).
  baseUrl: env.NEXT_PUBLIC_OLLAMA_BASE_URL || PROXY_BASE_URL,
  temperature: 0.2,
  numCtx: 8192,
  // Number of document pages sent to the model in a single request.
  pagesPerBatch: 2,
  // 'openai' | 'ollama' | 'deepseek' | 'demo'
  engine: 'openai',
  // One model is remembered per provider, so switching back and forth does not
  // lose the choice made on the other one.
  models: {
    openai: PROVIDERS.openai.defaultModel,
    ollama: env.NEXT_PUBLIC_OLLAMA_MODEL || PROVIDERS.ollama.defaultModel,
    deepseek: PROVIDERS.deepseek.defaultModel,
  },
};

/** The model currently in use, for the active provider. */
export const activeModel = (settings) =>
  settings.models?.[settings.engine] ??
  PROVIDERS[settings.engine]?.defaultModel ??
  '';

/** The endpoint of the active provider: DeepSeek always goes through its proxy. */
export const activeBaseUrl = (settings) =>
  PROVIDERS[settings.engine]?.kind === 'cloud'
    ? PROVIDERS[settings.engine].baseUrl
    : settings.baseUrl;

export const loadSettings = () => {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      models: { ...DEFAULT_SETTINGS.models, ...stored.models },
    };
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

export const isProxied = (baseUrl) => String(baseUrl ?? '').startsWith('/');
