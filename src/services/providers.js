/**
 * Dispatches to the client of the active provider.
 *
 * Both clients expose the same two functions — `listModels` and `chatJson` —
 * so everything upstream (analysisService, the connection hook) stays unaware
 * of which one is running.
 */

import * as ollama from './ollamaClient.js';
import * as deepseek from './deepseekClient.js';

export const providerFor = (engine) => (engine === 'deepseek' ? deepseek : ollama);

export const listModels = (engine, baseUrl, options) =>
  providerFor(engine).listModels(baseUrl, options);

export const chatJson = (engine, baseUrl, options) =>
  providerFor(engine).chatJson(baseUrl, options);
