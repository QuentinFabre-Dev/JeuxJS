/**
 * Minimal browser client for the local Ollama HTTP API.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import { isProxied } from '../config/ollama.js';

export class OllamaError extends Error {
  constructor(message, { cause, hint } = {}) {
    super(message);
    this.name = 'OllamaError';
    this.cause = cause;
    this.hint = hint;
  }
}

const unreachable = (baseUrl, cause) =>
  new OllamaError(`Cannot reach Ollama at ${baseUrl}`, {
    cause,
    hint: isProxied(baseUrl)
      ? 'Start the server with `ollama serve`, then restart `npm run dev` so the proxy picks it up.'
      : 'Start `ollama serve` and allow the browser origin: OLLAMA_ORIGINS=* ollama serve',
  });

/** GET /api/tags — also used as the health check. */
export const listModels = async (baseUrl, { signal } = {}) => {
  let response;
  try {
    response = await fetch(`${baseUrl}/api/tags`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw unreachable(baseUrl, error);
  }
  if (!response.ok) {
    // Through the dev proxy an unreachable Ollama surfaces as a 5xx from Vite,
    // not as a network error: report it as "offline" rather than as a bad reply.
    if (isProxied(baseUrl) && response.status >= 500) {
      throw unreachable(baseUrl);
    }
    throw new OllamaError(`Ollama replied ${response.status} on /api/tags`);
  }
  const data = await response.json();
  return (data.models ?? []).map((model) => ({
    name: model.name,
    size: model.size,
    parameterSize: model.details?.parameter_size,
    quantization: model.details?.quantization_level,
  }));
};

/**
 * Model families whose chat template has no system turn.
 *
 * Gemma is the notable one: its template only knows `user` and `model` turns.
 * Whether a separate system message survives then depends on the template
 * shipped with the model, and a silently dropped system prompt means the review
 * rules — answer in JSON, never invent — never reach the model at all. Folding
 * it into the first user message costs nothing and removes the question.
 */
const NO_SYSTEM_ROLE = /gemma/i;

/** Builds the message list, honouring the model's template constraints. */
export const buildMessages = (model, system, user) => {
  if (!system) return [{ role: 'user', content: user }];
  if (NO_SYSTEM_ROLE.test(model ?? '')) {
    return [{ role: 'user', content: `${system}\n\n---\n\n${user}` }];
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
};

/**
 * POST /api/chat with `stream: true`, forcing a JSON object answer.
 * `onToken` receives each chunk of text as it arrives, which is what makes
 * findings appear progressively instead of in one final burst.
 */
export const chatJson = async (
  baseUrl,
  { model, system, prompt, temperature, numCtx, signal, onToken }
) => {
  let response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: true,
        format: 'json',
        messages: buildMessages(model, system, prompt),
        options: { temperature, num_ctx: numCtx },
      }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw unreachable(baseUrl, error);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 404) {
      throw new OllamaError(`Model "${model}" is not installed.`, {
        hint: `Run: ollama pull ${model}`,
      });
    }
    throw new OllamaError(
      `Ollama replied ${response.status} on /api/chat. ${detail.slice(0, 200)}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      let chunk;
      try {
        chunk = JSON.parse(line);
      } catch {
        continue; // partial line, will be completed on the next read
      }
      if (chunk.error) throw new OllamaError(chunk.error);
      const token = chunk.message?.content ?? '';
      if (token) {
        content += token;
        onToken?.(token, content);
      }
    }
  }

  return content;
};

/** Parses a JSON object out of a model answer, fenced or not. */
export const extractJson = (text) => {
  const candidates = [text, text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(trimmed.slice(start, end + 1));
        } catch {
          /* try next candidate */
        }
      }
    }
  }
  throw new OllamaError('The model did not return usable JSON.', {
    hint: `Answer started with: ${text.slice(0, 160)}`,
  });
};
