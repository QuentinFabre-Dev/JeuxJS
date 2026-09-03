/**
 * A corrected Word document.
 *
 * A `.docx` is a ZIP of XML parts. The corrections are applied inside those
 * parts and everything else — styles, numbering, images, section breaks,
 * relationships — is copied through untouched. The document that comes out is
 * the one that went in, with words changed.
 *
 * Body text is not the only place text lives: a client's name can sit in a
 * header, a caveat in a footnote. Those parts are rewritten too, and the
 * order below is the order a reader meets them.
 */
import { rewritePart } from './ooxml.js';

const PART = /^word\/(document\d*|header\d+|footer\d+|footnotes|endnotes)\.xml$/;

export const rewriteDocx = async (bytes, edits, { dom } = {}) => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);

  const parts = Object.keys(zip.files)
    .filter((name) => PART.test(name))
    .sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)));

  if (!parts.length) throw new Error("Ce fichier ne contient pas de document Word lisible.");

  const applied = [];
  const skipped = [];
  const placed = new Set();

  for (const name of parts) {
    // A sentence found in the body has no business being corrected again in a
    // header that happens to repeat it.
    const remaining = edits.filter((edit) => !placed.has(edit.sentenceId));
    if (!remaining.length) break;

    const result = rewritePart(await zip.file(name).async('string'), remaining, {
      textTag: 'w:t',
      paragraphTag: 'w:p',
      dom,
    });

    if (result.applied.length || result.skipped.length) {
      zip.file(name, result.xml);
    }
    applied.push(...result.applied);
    skipped.push(...result.skipped);
    for (const sentenceId of result.done) placed.add(sentenceId);
  }

  const notFound = edits
    .filter((edit) => !placed.has(edit.sentenceId))
    .map((edit) => ({ sentenceId: edit.sentenceId, ids: edit.ids, original: edit.original }));

  return {
    blob: await zip.generateAsync({
      type: 'blob',
      // Word refuses an archive that is not deflated the way it expects.
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
    }),
    applied,
    notFound,
    skipped,
  };
};
