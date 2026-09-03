/**
 * Runs one check against one slice of the document.
 *
 * Everything model-specific lives here: which tier answers, how much reasoning
 * it is allowed, and what shape the answer must take. The rest of the pipeline
 * sees tasks in and candidates out.
 *
 * Two decisions carry the cost:
 *
 * - **Reasoning is set to `minimal`.** Reasoning tokens are billed as output
 *   and paid for in latency; on checks that report sentence-level defects,
 *   thinking longer buys nothing measurable and can triple the bill.
 *
 * - **The instructions are byte-identical across every call of a review**,
 *   which is what makes them eligible for the prompt cache. The saving is real
 *   but modest here: caching only starts above a prompt-length threshold, and
 *   these prompts are short.
 *
 * Structured outputs (`text.format`, strict) are what removed the old
 * `extractJson` / `scanCompleteObjects` machinery: there is no truncated JSON
 * left to recover from.
 */
import OpenAI from 'openai';

import { checkById } from './registry.js';
import { modelFor } from './pricing.js';
import { FINDINGS_SCHEMA } from './schema.js';
import { formatSentences, loadPrompt, render } from './prompt.js';
import { consistencyCandidates, documentHeadings } from './sentences.js';
import { VERDICTS_SCHEMA, formatCandidates } from './critic.js';
import { COMMITMENTS_SCHEMA, COMPLIANCE_SCHEMA, relevantSentences } from './sow.js';

// Bounded on purpose: these answers are short JSON objects. A ceiling is the
// cheapest protection against a model that decides to be thorough.
const MAX_OUTPUT_TOKENS = 2048;

let client = null;
const openai = () => {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Aucune clé OPENAI_API_KEY côté serveur : la revue ne peut pas s'exécuter.");
    }
    // The SDK retries 429 and 5xx on its own; a review finishes late rather
    // than failing because the fan-out pushed too hard.
    client = new OpenAI({ maxRetries: 3 });
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
    domain: context.domain ? `\n${context.domain}\n` : '',
  });

  return {
    model: modelFor(check.model).id,
    // Stable across the whole review: this is the prefix the cache can serve.
    instructions: loadPrompt('_system.md'),
    input: prompt,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    reasoning: { effort: 'minimal' },
    text: {
      format: {
        type: 'json_schema',
        name: 'findings',
        schema: FINDINGS_SCHEMA,
        strict: true,
      },
    },
  };
};

const usageOf = (usage) => ({
  inputTokens: usage?.input_tokens ?? 0,
  outputTokens: usage?.output_tokens ?? 0,
  cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
  reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
});

/** One request, one parsed JSON payload. Shared by the checks and the critic. */
const call = async (request, signal) => {
  const response = await openai().responses.create(request, { signal });

  // A refusal comes back as content, not as an error.
  if (response.output?.some((item) => item.content?.some((part) => part.type === 'refusal'))) {
    throw new Error("Le modèle a refusé d'analyser ce passage.");
  }
  if (response.status === 'incomplete') {
    throw new Error(
      `Réponse tronquée (${response.incomplete_details?.reason ?? 'raison inconnue'}).`
    );
  }

  try {
    return { parsed: JSON.parse(response.output_text || '{}'), usage: usageOf(response.usage) };
  } catch {
    // Strict structured output makes this close to impossible; if it happens,
    // one call is lost, not the review.
    throw new Error('Réponse illisible du modèle.');
  }
};

/**
 * Verifies a packet of candidates.
 *
 * Runs on the small tier: judging a claim against its sentence is a narrower
 * task than making the claim, and a critic that costs more than the reviewer
 * it checks would not survive the first invoice.
 */
export const runCritic = async (candidates, { sentenceOf, signal }) => {
  const { parsed, usage } = await call(
    {
      model: modelFor('fast').id,
      instructions: loadPrompt('_system.md'),
      input: render(loadPrompt('critic.md'), {
        candidates: formatCandidates(candidates, sentenceOf),
      }),
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: 'minimal' },
      text: {
        format: { type: 'json_schema', name: 'verdicts', schema: VERDICTS_SCHEMA, strict: true },
      },
    },
    signal
  );

  return { verdicts: Array.isArray(parsed.verdicts) ? parsed.verdicts : [], usage };
};

/**
 * Reads a signed statement of work and lists what it commits the firm to.
 *
 * Runs on the reasoning tier: telling an obligation from boilerplate, and a
 * deliverable from a payment term, is exactly the judgement the small tier
 * gets wrong.
 */
export const extractCommitments = async ({ sowSentences, language, signal }) => {
  const { parsed, usage } = await call(
    {
      model: modelFor('main').id,
      instructions: loadPrompt('_system.md'),
      input: render(loadPrompt('sow-extract.md'), {
        sow: formatSentences(sowSentences),
        language: languageLine(language),
      }),
      max_output_tokens: 4096,
      reasoning: { effort: 'minimal' },
      text: {
        format: {
          type: 'json_schema',
          name: 'commitments',
          schema: COMMITMENTS_SCHEMA,
          strict: true,
        },
      },
    },
    signal
  );

  return {
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
    usage,
  };
};

/**
 * Checks one packet of commitments against the deliverable.
 *
 * Only the sentences whose vocabulary overlaps a commitment are sent, which is
 * what keeps this affordable on a long deliverable — the selection itself is
 * free and happens before any call.
 */
export const verifyCommitments = async (commitments, { sentences, language, signal }) => {
  const excerpts = new Map();
  for (const commitment of commitments) {
    for (const sentence of relevantSentences(commitment, sentences)) {
      excerpts.set(sentence.id, sentence);
    }
  }

  const { parsed, usage } = await call(
    {
      model: modelFor('main').id,
      instructions: loadPrompt('_system.md'),
      input: render(loadPrompt('sow-verify.md'), {
        commitments: commitments
          .map((commitment) => `[${commitment.id}] (${commitment.kind}) ${commitment.text}`)
          .join('\n'),
        excerpts: formatSentences([...excerpts.values()]),
        language: languageLine(language),
      }),
      max_output_tokens: 4096,
      reasoning: { effort: 'minimal' },
      text: {
        format: {
          type: 'json_schema',
          name: 'compliance',
          schema: COMPLIANCE_SCHEMA,
          strict: true,
        },
      },
    },
    signal
  );

  return { verdicts: Array.isArray(parsed.verdicts) ? parsed.verdicts : [], usage };
};

/**
 * @returns {{findings: object[], usage: object}} raw candidates, in the shape
 *          `normaliseFinding` expects — the same door the deterministic checks
 *          come through.
 */
export const runTask = async (task, { documentModel, sentences, context = {}, signal }) => {
  const check = checkById(task.check);
  if (!check?.prompt) throw new Error(`Aucun moteur pour le contrôle « ${task.check} ».`);

  const slice = sentencesForTask(task, sentences);
  if (!slice.length) return { findings: [], usage: usageOf(null) };

  const { parsed, usage } = await call(
    buildRequest(check, { sentences: slice, documentModel, context }),
    signal
  );

  return {
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    usage,
  };
};
