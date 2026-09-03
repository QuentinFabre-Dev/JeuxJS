/**
 * Correcting text inside an Office XML part.
 *
 * Word and PowerPoint store text the same way: paragraphs holding *runs*, and
 * the characters in leaf nodes — `<w:t>` for Word, `<a:t>` for PowerPoint. The
 * mechanics of correcting them are therefore identical, and live here once.
 *
 * The trap is that a sentence is almost never in one node. Word splits a run
 * at every change of formatting, every pass of the spell checker, every
 * revision mark: ten words can occupy five runs. Rewriting the sentence into
 * the first run and emptying the rest works, and destroys the formatting the
 * emptied runs carried — measured at four runs out of five (see
 * `spikes/docx-run-rewrite.cjs`).
 *
 * So the sentence is located across the whole part, narrowed to the characters
 * that actually change, and only the nodes that segment touches are rewritten.
 * A spelling fix then lands on a single run and everything else is left alone.
 */
import { locate, narrowToChange } from './locate.js';

/** The environment's XML parser, or one injected by the tests. */
const domOf = (dom) => {
  const Parser = dom?.DOMParser ?? globalThis.DOMParser;
  const Serializer = dom?.XMLSerializer ?? globalThis.XMLSerializer;
  if (!Parser || !Serializer) throw new Error("Pas d'analyseur XML disponible.");
  return { parse: (xml) => new Parser().parseFromString(xml, 'application/xml'), Serializer };
};

/**
 * The part's text, with a map from each character back to its node.
 *
 * A paragraph break contributes a `\n` that belongs to no node — the same
 * separator the text extraction produces, so that a sentence spanning two
 * paragraphs is found here too.
 */
const readSegments = (doc, { textTag, paragraphTag }) => {
  const segments = [];
  let text = '';

  for (const paragraph of Array.from(doc.getElementsByTagName(paragraphTag))) {
    for (const node of Array.from(paragraph.getElementsByTagName(textTag))) {
      const value = node.textContent ?? '';
      segments.push({ node, start: text.length, end: text.length + value.length });
      text += value;
    }
    text += '\n';
  }

  return { text, segments };
};

/**
 * Word drops leading and trailing spaces unless the node says otherwise, which
 * would silently glue two words together.
 */
const preserveSpace = (node, textTag) => {
  if (!/^\s|\s$/.test(node.textContent ?? '')) return;
  const prefix = textTag.includes(':') ? textTag.split(':')[0] : null;
  if (prefix === 'w') node.setAttribute('xml:space', 'preserve');
};

/**
 * @param {string} xml    the part, as it sits in the archive
 * @param {{sentenceId:string, original:string, text:string, ids:string[]}[]} edits
 * @returns {{xml:string, applied:string[], done:Set<string>, skipped:object[]}}
 */
export const rewritePart = (xml, edits, { textTag, paragraphTag, dom } = {}) => {
  const { parse, Serializer } = domOf(dom);
  const doc = parse(xml);
  // Re-read after every correction: applying one shifts every offset after it,
  // and a stale map puts the next correction one character off — which is
  // exactly enough to write "les testsonta été".
  let state = readSegments(doc, { textTag, paragraphTag });

  const applied = [];
  const done = new Set();
  const skipped = [];
  let touched = false;

  for (const edit of edits) {
    const at = locate(state.text, edit.original);
    if (!at) continue; // Not in this part; another one may hold it.

    const span = narrowToChange(state.text, at, edit.original, edit.text);
    if (!span) {
      done.add(edit.sentenceId);
      continue;
    }

    const covered = state.segments.filter(
      (segment) => segment.end > span.start && segment.start < span.end
    );

    // The change straddles a paragraph break, which no edit to a text node can
    // express: a paragraph mark is structure, not characters. Reported rather
    // than approximated.
    if (!covered.length || covered[covered.length - 1].end < span.end) {
      skipped.push({
        sentenceId: edit.sentenceId,
        ids: edit.ids,
        reason: 'La correction traverse une fin de paragraphe.',
      });
      done.add(edit.sentenceId);
      continue;
    }

    covered.forEach((segment, index) => {
      const value = segment.node.textContent ?? '';
      const head = value.slice(0, Math.max(0, span.start - segment.start));
      const tail = value.slice(Math.max(0, span.end - segment.start));
      segment.node.textContent =
        index === 0
          ? head + span.replacement + (covered.length === 1 ? tail : '')
          : tail;
      preserveSpace(segment.node, textTag);
    });

    applied.push(...edit.ids);
    done.add(edit.sentenceId);
    touched = true;

    state = readSegments(doc, { textTag, paragraphTag });
  }

  return {
    xml: touched ? new Serializer().serializeToString(doc) : xml,
    applied,
    done,
    skipped,
  };
};
