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
