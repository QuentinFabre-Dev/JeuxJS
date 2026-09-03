/**
 * The part of a sentence that a correction actually changes.
 *
 * A suggestion is a full rewritten sentence, but rewriting the whole sentence
 * in the document is destructive: in a Word file a sentence is spread over
 * several runs, and replacing all of them flattens the formatting they carry.
 * Trimming to the changed span turns a spelling fix into a one-character edit —
 * measured at one run touched out of five instead of four (see
 * `spikes/docx-run-rewrite.cjs`).
 *
 * Coordinates are those of the original sentence.
 */
export const changedSpan = (original, corrected) => {
  if (original === corrected) return null;

  let start = 0;
  while (
    start < original.length &&
    start < corrected.length &&
    original[start] === corrected[start]
  ) {
    start += 1;
  }

  let tail = 0;
  while (
    tail < original.length - start &&
    tail < corrected.length - start &&
    original[original.length - 1 - tail] === corrected[corrected.length - 1 - tail]
  ) {
    tail += 1;
  }

  return {
    start,
    end: original.length - tail,
    replacement: corrected.slice(start, corrected.length - tail),
  };
};

/** Do two edits of the same sentence touch the same characters? */
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/**
 * Applies spans to the text they were computed against.
 *
 * Right to left, so that an earlier span's coordinates are still valid after a
 * later one has changed the length of the string.
 */
export const applySpans = (original, spans) =>
  [...spans]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, span) => text.slice(0, span.start) + span.replacement + text.slice(span.end),
      original
    );
