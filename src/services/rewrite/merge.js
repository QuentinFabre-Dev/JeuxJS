/**
 * Two accepted findings on the same sentence.
 *
 * Spelling and clarity can land on the same sentence, and each returns a full
 * rewrite of it. Applying them one after the other cannot work: the second was
 * written against the original sentence, which no longer exists once the first
 * has been applied.
 *
 * So they are merged the way two edits to a common ancestor are merged — by
 * the part each one changes. Disjoint edits combine cleanly; edits touching the
 * same characters conflict, and the conflicting one is **reported, not
 * silently dropped and not blindly applied**.
 */
import { applySpans, changedSpan, overlaps } from './span.js';

/**
 * @param {string} original       the sentence as it appears in the document
 * @param {{id:string, suggestion:string}[]} corrections  accepted, in order
 * @returns {{text:string, applied:string[], conflicts:string[]}}
 */
export const mergeCorrections = (original, corrections) => {
  const kept = [];
  const applied = [];
  const conflicts = [];

  for (const correction of corrections) {
    const span = changedSpan(original, correction.suggestion);

    // A suggestion identical to the original changes nothing; counting it as
    // applied would inflate the number shown on the button.
    if (!span) continue;

    if (kept.some((existing) => overlaps(existing.span, span))) {
      conflicts.push(correction.id);
      continue;
    }

    kept.push({ span, id: correction.id });
    applied.push(correction.id);
  }

  return {
    text: kept.length ? applySpans(original, kept.map((entry) => entry.span)) : original,
    applied,
    conflicts,
  };
};
