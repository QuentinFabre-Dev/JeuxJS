/**
 * Sentence splitting shared by every format reader.
 *
 * Lives apart from `documentParser` so that format-specific readers can use it
 * without importing the module that imports them back.
 */

/** A fragment with almost no letters is not a sentence — "1.", "(a)", "3.2". */
const isDegenerate = (fragment) => (fragment.match(/\p{L}/gu) ?? []).length < 3;

/**
 * Splits a paragraph into sentences, keeping their punctuation.
 *
 * Numbered headings ("1. Introduction") would otherwise be cut right after the
 * number, producing a one-character sentence that the model is then asked to
 * review; such fragments are merged into the sentence that follows.
 */
export const splitSentences = (paragraph) => {
  const fragments = paragraph
    .replace(/\s+/g, ' ')
    .trim()
    // Split after . ! ? … followed by a space and an uppercase-ish start.
    .split(/(?<=[.!?…])\s+(?=[«"'(\[]?[A-ZÀ-ÝŒ0-9])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const merged = [];
  let pending = '';
  for (const fragment of fragments) {
    const candidate = pending ? `${pending} ${fragment}` : fragment;
    if (isDegenerate(candidate)) {
      pending = candidate;
      continue;
    }
    merged.push(candidate);
    pending = '';
  }
  if (pending) {
    // Nothing to attach it to: keep it rather than losing content.
    if (merged.length) merged[merged.length - 1] += ` ${pending}`;
    else merged.push(pending);
  }
  return merged;
};

const looksLikeHeading = (text) =>
  text.length <= 90 &&
  !/[.!?]$/.test(text) &&
  (/^\d+(\.\d+)*[.)]?\s+\S/.test(text) || text === text.toUpperCase());

/** Converts raw text into typed blocks (headings + one block per sentence). */
export const textToBlocks = (raw) => {
  const blocks = [];
  for (const paragraph of raw.split(/\n\s*\n+/)) {
    const clean = paragraph.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (looksLikeHeading(clean)) {
      blocks.push({ kind: 'heading', text: clean });
      continue;
    }
    for (const sentence of splitSentences(clean)) {
      blocks.push({ kind: 'p', text: sentence });
    }
  }
  return blocks;
};

/**
 * Builds a whitespace-normalised copy of `text` along with, for each character
 * of the copy, its index in the original. Sentences are matched on the
 * normalised form (that is what `textToBlocks` produces) but the positions we
 * need live in the original.
 */
export const normaliseWithMap = (text) => {
  let normalised = '';
  const map = [];
  let previousWasSpace = true;

  for (let i = 0; i < text.length; i++) {
    const isSpace = /\s/.test(text[i]);
    if (isSpace) {
      if (previousWasSpace) continue;
      normalised += ' ';
      map.push(i);
      previousWasSpace = true;
    } else {
      normalised += text[i];
      map.push(i);
      previousWasSpace = false;
    }
  }
  return { normalised, map };
};

/**
 * Rebuilds paragraphs from the visual lines of a PDF page.
 *
 * A PDF has no notion of paragraph: joining every line with a space would glue
 * a heading to the text under it, and the sentence splitter would then produce
 * fragments like "1." on its own. A short line that does not end a sentence and
 * is followed by a new one is treated as a standalone block — that is what a
 * heading looks like.
 */
export const joinPdfLines = (pageText) => {
  const lines = pageText.replace(/-\n/g, '').split('\n');
  let result = '';

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!result.endsWith('\n\n')) result += '\n\n';
      return;
    }

    const next = (lines[index + 1] ?? '').trim();
    const endsSentence = /[.!?…:]$/.test(trimmed);
    const nextStartsBlock = /^[«"'(\[]?[A-ZÀ-ÝŒ0-9]/.test(next);
    const standalone = trimmed.length < 60 && !endsSentence && nextStartsBlock;

    result += trimmed;
    if (!next) return;
    result += standalone || (endsSentence && trimmed.length < 60) ? '\n\n' : ' ';
  });

  return result.replace(/\n{3,}/g, '\n\n').trim();
};

