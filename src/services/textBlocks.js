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
