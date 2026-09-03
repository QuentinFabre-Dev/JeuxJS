/**
 * A corrected PowerPoint deck.
 *
 * PowerPoint stores its text like Word does — paragraphs of runs, characters
 * in leaf nodes — so the correcting machinery is the shared one, with `<a:t>`
 * and `<a:p>` instead of their Word counterparts. Slides, layouts, masters,
 * images, animations and speaker notes are copied through untouched.
 *
 * One thing is genuinely different, and it is the reason this batch is not
 * simply a two-line alias: **PowerPoint does not reflow**. Word grows a
 * paragraph and pushes the rest of the page down; a slide has a text box of a
 * fixed size, and a correction one word longer can push a line out of it.
 * Nothing here can decide whether it will — that depends on the font, the box
 * and the autofit setting — so the deck is corrected and the slides whose text
 * grew are **named**, for a human to glance at.
 */
import { rewritePart } from './ooxml.js';

const SLIDE = /^ppt\/(slides\/slide(\d+)|notesSlides\/notesSlide(\d+))\.xml$/;

const slideNumber = (name) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);

export const rewritePptx = async (bytes, edits, { dom } = {}) => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);

  const parts = Object.keys(zip.files)
    .filter((name) => SLIDE.test(name))
    // Slides before their speaker notes, and slides in their own order: a
    // correction should land on the first slide that carries the sentence.
    .sort((a, b) => {
      const notes = Number(a.includes('notesSlides')) - Number(b.includes('notesSlides'));
      return notes !== 0 ? notes : slideNumber(a) - slideNumber(b);
    });

  if (!parts.length) throw new Error('Ce fichier ne contient aucune diapositive lisible.');

  const applied = [];
  const skipped = [];
  const grown = [];
  const placed = new Set();

  for (const name of parts) {
    const remaining = edits.filter((edit) => !placed.has(edit.sentenceId));
    if (!remaining.length) break;

    const result = rewritePart(await zip.file(name).async('string'), remaining, {
      textTag: 'a:t',
      paragraphTag: 'a:p',
      dom,
    });

    if (result.applied.length || result.skipped.length) zip.file(name, result.xml);
    applied.push(...result.applied);
    skipped.push(...result.skipped);
    for (const entry of result.lengthened) {
      grown.push({ ...entry, slide: slideNumber(name), notes: name.includes('notesSlides') });
    }
    for (const sentenceId of result.done) placed.add(sentenceId);
  }

  const notFound = edits
    .filter((edit) => !placed.has(edit.sentenceId))
    .map((edit) => ({ sentenceId: edit.sentenceId, ids: edit.ids, original: edit.original }));

  return {
    blob: await zip.generateAsync({
      type: 'blob',
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'DEFLATE',
    }),
    applied,
    notFound,
    skipped,
    // The slides a human should glance at before sending the deck.
    grown: [...new Set(grown.filter((entry) => !entry.notes).map((entry) => entry.slide))].sort(
      (a, b) => a - b
    ),
  };
};
