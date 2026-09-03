/**
 * Finding a sentence in the file it came from.
 *
 * The text the analysis saw did not come out of the same door as the text in
 * the file: extraction normalises whitespace, joins lines, and turns a run of
 * spaces into one. So an exact `indexOf` fails on perfectly ordinary
 * documents.
 *
 * The search is therefore done on a normalised form, and the position is
 * mapped back to the real text — the same trick `normaliseWithMap` already
 * performs for OCR and PDF anchoring, reused rather than reinvented.
 */
import { normaliseWithMap } from '../textBlocks.js';
import { changedSpan } from './span.js';

/**
 * @param {string} haystack  the real text, as it sits in the file
 * @param {string} needle    the sentence to find
 * @param {number} [from]    index in `haystack` to start from
 * @returns {{start:number, end:number}|null} coordinates in `haystack`
 */
export const locate = (haystack, needle, from = 0) => {
  const wanted = normaliseWithMap(needle).normalised.trim();
  if (!wanted) return null;

  const { normalised, map } = normaliseWithMap(haystack);

  // Where `from` lands once normalised, so a second search of the same
  // sentence does not find the first occurrence again.
  let cursor = 0;
  while (cursor < map.length && map[cursor] < from) cursor += 1;

  const at = normalised.indexOf(wanted, cursor);
  if (at === -1) return null;

  return { start: map[at], end: map[at + wanted.length - 1] + 1 };
};

/**
 * Narrows a located sentence to the characters that actually change.
 *
 * Replacing a whole sentence destroys whatever it spans — a line break in a
 * text file, the runs carrying bold and italic in a Word paragraph. Every
 * format needs this, so it lives here rather than in each of them.
 *
 * @param {string} raw    the text the sentence was located in
 * @param {{start:number,end:number}} at  where the sentence sits in `raw`
 * @param {string} original   the sentence as the analysis saw it
 * @param {string} corrected  the accepted suggestion
 * @returns {{start:number,end:number,replacement:string}|null} in `raw`
 */
export const narrowToChange = (raw, at, original, corrected) => {
  const span = changedSpan(original, corrected);
  if (!span) return null;

  const slice = raw.slice(at.start, at.end);
  const { map } = normaliseWithMap(slice);

  // A pure insertion has no characters of its own to point at: it lands where
  // the following character sits, or at the end of the sentence.
  const from = span.start < map.length ? map[span.start] : slice.length;
  const to = span.end > span.start ? map[span.end - 1] + 1 : from;

  return { start: at.start + from, end: at.start + to, replacement: span.replacement };
};
