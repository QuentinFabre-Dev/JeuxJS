/**
 * DeepSeek client, exposing the same interface as the Ollama one.
 *
 * The API is OpenAI-compatible, which changes two things compared to Ollama:
 * responses stream as Server-Sent Events instead of NDJSON, and JSON mode is
 * requested with `response_format` instead of `format`.
 *
 * Requests go through the `/deepseek` Vite proxy, which injects the API key
 * server-side (see vite.config.js). The key is never in the browser.
 */

import { OllamaError as ProviderError, extractJson } from './ollamaClient.js';

export { extractJson };

const KEY_HINT =
  'Add DEEPSEEK_API_KEY to your .env file, then restart `npm run dev` so the proxy picks it up.';

const failure = async (response) => {
  const detail = await response.text().catch(() => '');
  if (response.status === 401 || response.status === 403) {
    return new ProviderError('DeepSeek rejected the API key.', { hint: KEY_HINT });
  }
  if (response.status === 402) {
    return new ProviderError('DeepSeek account has no credit left.', {
      hint: 'Top up the account, or switch back to the local model.',
    });
  }
  if (response.status === 429) {
    return new ProviderError('DeepSeek is rate limiting the requests.', {
      hint: 'Wait a moment, or lower the concurrency.',
    });
  }
  return new ProviderError(
    `DeepSeek replied ${response.status}. ${detail.slice(0, 200)}`
  );
};

const unreachable = (cause) =>
  new ProviderError('Cannot reach DeepSeek through the dev proxy.', {
    cause,
    hint: 'Check the internet connection, and that `npm run dev` is running.',
  });

/** GET /models — also serves as the health and API-key check. */
export const listModels = async (baseUrl, { signal } = {}) => {
  let response;
  try {
    response = await fetch(`${baseUrl}/models`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw unreachable(error);
  }
  if (!response.ok) throw await failure(response);

  const data = await response.json();
  return (data.data ?? []).map((model) => ({
    name: model.id,
    // The API reports no size or parameter count; the UI handles their absence.
    size: null,
    parameterSize: null,
  }));
};

/**
 * Extracts the text deltas from a chunk of an SSE stream.
 *
 * @returns {{ tokens: string[], rest: string }} `rest` is the trailing partial
 * line, to be prepended to the next chunk.
 */
export const parseSseChunk = (buffer) => {
  const tokens = [];
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const parsed = JSON.parse(payload);
      const token = parsed.choices?.[0]?.delta?.content;
      if (token) tokens.push(token);
    } catch {
      // A `data:` line split across two chunks: it comes back complete in the
      // next read, through `rest`.
    }
  }

  return { tokens, rest };
};

export const chatJson = async (
  baseUrl,
  { model, system, prompt, temperature, signal, onToken }
) => {
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: true,
        // The OpenAI-compatible way of forcing a JSON object answer. The prompts
        // already spell out the schema and contain the word "json", which the
        // API requires.
        response_format: { type: 'json_object' },
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw unreachable(error);
  }

  if (!response.ok) throw await failure(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { tokens, rest } = parseSseChunk(buffer);
    buffer = rest;

    for (const token of tokens) {
      content += token;
      onToken?.(token, content);
    }
  }

  return content;
};
