/**
 * Runs one check against one slice of the document.
 *
 * Everything model-specific lives here: which tier answers, how deeply it is
 * allowed to think, and what shape the answer must take. The rest of the
 * pipeline sees tasks in and candidates out.
 *
 * Two decisions are worth their comment:
 *
 * - **Effort is only sent to Opus.** Reflection is on by default on Opus 5 and
 *   is billed as output; `low` is what keeps a review at twenty cents instead
 *   of sixty. It is never *disabled* — a thinking-off Opus writes tool calls
 *   into its visible text and leaks internal tags. Haiku 4.5 does not accept
 *   the parameter at all, so it is omitted there.
 *
 * - **The system prompt is cached.** It is byte-identical across every call of
 *   a review, which is exactly the prefix a cache is for: the second of
 *   thirty-one calls reads it at a tenth of the price.
 */
import Anthropic from '@anthropic-ai/sdk';

import { checkById } from './registry.js';
import { modelFor } from './pricing.js';
import { FINDINGS_SCHEMA } from './schema.js';
import { formatSentences, loadPrompt, render } from './prompt.js';
import { consistencyCandidates, documentHeadings, documentSentences } from './sentences.js';

// Bounded on purpose: these answers are short JSON objects. A ceiling is the
// cheapest protection against a model that decides to be thorough.
const MAX_TOKENS = 2048;

let client = null;
const anthropic = () => {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Aucune clé ANTHROPIC_API_KEY côté serveur : la revue ne peut pas s'exécuter.");
    }
    // The SDK retries 429 and 5xx on its own; a review finishes late rather
    // than failing because the fan-out pushed too hard.
    client = new Anthropic({ maxRetries: 3 });
  }
  return client;
};

const languageLine = (language) =>
  language && language !== 'en'
    ? `\nThe document is written in ${language}. Write every suggestion AND every explanation in that language, and apply its grammar and style conventions.\n`
    : '';

const glossaryLine = (glossary = []) =>
  glossary.length
    ? `\nThese terms are business vocabulary, never spelling mistakes: ${glossary.join(', ')}.\n`
    : '';

/** The slice of document a task looks at. */
export const sentencesForTask = (task, sentences) => {
  if (task.scope === 'document') return consistencyCandidates(sentences);
  const pages = new Set(task.pages ?? []);
  return sentences.filter((sentence) => pages.has(sentence.page));
};

export const buildRequest = (check, { sentences, documentModel, context }) => {
  const prompt = render(loadPrompt(check.prompt), {
    sentences: formatSentences(sentences),
    headings: documentHeadings(documentModel)
      .map((heading) => `p${heading.page}: ${heading.text}`)
      .join('\n'),
    requirements: (context.requirements ?? []).map((line) => `- ${line}`).join('\n'),
    docType: context.docType ?? 'business document',
    serviceLine: context.serviceLine ?? 'professional services',
    language: languageLine(context.language),
    glossary: glossaryLine(context.glossary),
  });

  const model = modelFor(check.model);
  const request = {
    model: model.id,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text', text: loadPrompt('_system.md'), cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema: FINDINGS_SCHEMA } },
  };

  // Opus only: Haiku 4.5 rejects the parameter.
  if (check.model === 'main') request.output_config.effort = 'low';

  return request;
};

const usageOf = (usage = {}) => ({
  inputTokens: usage.input_tokens ?? 0,
  outputTokens: usage.output_tokens ?? 0,
  cachedInputTokens: usage.cache_read_input_tokens ?? 0,
});

/**
 * @returns {{findings: object[], usage: object}} raw candidates, in the shape
 *          `normaliseFinding` expects — the same door the deterministic checks
 *          come through.
 */
export const runTask = async (task, { documentModel, sentences, context = {}, signal }) => {
  const check = checkById(task.check);
  if (!check?.prompt) throw new Error(`Aucun moteur pour le contrôle « ${task.check} ».`);

  const slice = sentencesForTask(task, sentences);
  if (!slice.length) return { findings: [], usage: usageOf() };

  const response = await anthropic().messages.create(
    buildRequest(check, { sentences: slice, documentModel, context }),
    { signal }
  );

  if (response.stop_reason === 'refusal') {
    throw new Error("Le modèle a refusé d'analyser ce passage.");
  }

  const text = response.content.find((block) => block.type === 'text')?.text ?? '{}';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Structured output makes this close to impossible; if it happens, one
    // check is lost, not the review.
    throw new Error('Réponse illisible du modèle.');
  }

  return {
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    usage: usageOf(response.usage),
  };
};
