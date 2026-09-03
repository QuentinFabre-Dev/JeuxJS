/**
 * Prompts live in Markdown files, not in JavaScript.
 *
 * A prompt is the part of this system a reviewer without a compiler should be
 * able to read and improve — so it sits in `llm/*.md`, versioned and reviewed
 * like code, rather than buried in a template literal. The body is a template
 * with `{{variables}}` and nothing else: no conditionals, no loops. The moment
 * a prompt needs logic, the logic belongs in JavaScript.
 *
 * Files are read from disk once and cached: on a serverless runtime that is a
 * single read per cold start.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map();

const PROMPT_DIR = join(process.cwd(), 'lib', 'checks', 'llm');

export const loadPrompt = (name) => {
  if (!cache.has(name)) {
    cache.set(name, readFileSync(join(PROMPT_DIR, name), 'utf8'));
  }
  return cache.get(name);
};

/**
 * Substitutes `{{name}}` placeholders. An unknown placeholder becomes empty
 * rather than staying visible: a literal `{{glossary}}` reaching the model is
 * an instruction it will try to follow.
 */
export const render = (template, values = {}) =>
  String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    values[key] === undefined || values[key] === null ? '' : String(values[key])
  );

/** The sentences of a task, in the numbered form every prompt expects. */
export const formatSentences = (sentences) =>
  sentences.map((sentence) => `${sentence.id}: ${sentence.text}`).join('\n');
