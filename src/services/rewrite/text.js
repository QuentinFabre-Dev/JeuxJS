/**
 * Plain text and Markdown: the simple case, and the reference the other
 * formats are measured against.
 *
 * Two steps, and the second one matters more than it looks. Locating the
 * sentence is not enough: replacing it whole rewrites everything it spans,
 * including the line breaks inside it. A title split over two lines came back
 * as one — the correction was right and the layout was not.
 *
 * So the sentence is located, then narrowed to the characters that actually
 * change, and only those are replaced. The same reasoning that keeps bold and
 * italic alive inside a Word paragraph keeps a line break alive here.
 */
import { locate, narrowToChange } from './locate.js';

/**
 * @param {string} raw   the file's own text
 * @param {{sentenceId:string, original:string, text:string, ids:string[]}[]} edits
 * @returns {{content:string, applied:string[], notFound:object[]}}
 */
export const rewriteText = (raw, edits) => {
  const spans = [];
  const notFound = [];
  let cursor = 0;

  // Forward pass: find every sentence, in reading order.
  for (const edit of edits) {
    const at = locate(raw, edit.original, cursor);
    if (!at) {
      notFound.push({ sentenceId: edit.sentenceId, ids: edit.ids, original: edit.original });
      continue;
    }
    cursor = at.end;

    const span = narrowToChange(raw, at, edit.original, edit.text);
    if (!span) continue;
    spans.push({ ...span, ids: edit.ids });
  }

  // Backward pass: apply, so earlier offsets survive later replacements.
  const content = [...spans]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (text, span) => text.slice(0, span.start) + span.replacement + text.slice(span.end),
      raw
    );

  return { content, applied: spans.flatMap((span) => span.ids), notFound };
};
