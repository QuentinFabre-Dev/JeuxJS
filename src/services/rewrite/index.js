/**
 * The corrected document.
 *
 * Only findings the reviewer **accepted** are applied. A rejected finding
 * leaves the document untouched, and so does one still pending: on a
 * deliverable going to a client, silence is not consent.
 *
 * The original file is modified in place rather than rebuilt from the
 * extracted text — rebuilding would return the right words and none of the
 * layout. See `docs/plan-document-corrige.md`.
 */
import { REVIEW_STATES, stateOf } from '../../data/review.js';
import { mergeCorrections } from './merge.js';
import { rewriteDocx } from './docx.js';
import { rewriteText } from './text.js';

const REVIEWED = '_RyderReviewed';

/** `rapport.docx` → `rapport_RyderReviewed.docx`. */
export const reviewedName = (name) => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name}${REVIEWED}`;
  return `${name.slice(0, dot)}${REVIEWED}${name.slice(dot)}`;
};

/** Formats this can rewrite today. PowerPoint arrives in the next batch. */
export const REWRITABLE = ['text', 'docx'];

/** Why a format is refused, in the words the reader needs. */
export const REFUSAL = {
  pdf: 'A PDF positions its text character by character: correcting a word would shift everything after it on the line. Not supported.',
  pptx: 'PowerPoint decks are coming in the next batch.',
};

export const canRewrite = (documentModel) => REWRITABLE.includes(documentModel?.kind);

/**
 * Accepted findings, grouped by sentence and merged into one edit each.
 *
 * Grouping is what makes two corrections on the same sentence work: each one
 * was written against the same original, so they are merged by the part each
 * changes rather than applied one after the other.
 */
export const plannedEdits = (findings, states) => {
  const bySentence = new Map();

  for (const finding of findings) {
    if (stateOf(states, finding.id) !== REVIEW_STATES.ACCEPTED) continue;
    // Advisory findings point at something to look at, not at a replacement.
    // Accepting one means "noted", not "rewrite this".
    if (!finding.suggestion) continue;
    const group = bySentence.get(finding.sentenceId) ?? {
      sentenceId: finding.sentenceId,
      original: finding.original,
      corrections: [],
    };
    group.corrections.push({ id: finding.id, suggestion: finding.suggestion });
    bySentence.set(finding.sentenceId, group);
  }

  const edits = [];
  const conflicts = [];

  for (const group of bySentence.values()) {
    const merged = mergeCorrections(group.original, group.corrections);
    conflicts.push(...merged.conflicts);
    if (!merged.applied.length) continue;
    edits.push({
      sentenceId: group.sentenceId,
      original: group.original,
      text: merged.text,
      ids: merged.applied,
    });
  }

  return { edits, conflicts };
};

/** Dispatches to the writer that knows this format. */
const applyToFile = async ({ file, documentModel, edits }) => {
  if (documentModel.kind === 'docx') {
    const bytes = documentModel.source?.bytes ?? (await file.arrayBuffer());
    return rewriteDocx(bytes, edits);
  }

  if (documentModel.kind === 'pptx') {
    // PowerPoint arrives in the next batch. Refusing loudly beats handing back
    // a deck that quietly kept its mistakes.
    throw new Error('La régénération des fichiers PPTX arrive au prochain lot.');
  }

  const raw = await file.text();
  const { content, applied, notFound } = rewriteText(raw, edits);
  return { blob: new Blob([content], { type: file.type || 'text/plain' }), applied, notFound };
};

/**
 * @returns {{blob: Blob, filename: string, report: object}}
 */
export const rewriteDocument = async ({ file, documentModel, findings, states }) => {
  if (!canRewrite(documentModel)) {
    throw new Error(`Le format ${documentModel?.kind ?? 'inconnu'} ne peut pas être régénéré.`);
  }

  const { edits, conflicts } = plannedEdits(findings, states);
  if (!edits.length) {
    throw new Error("Aucune correction acceptée : il n'y a rien à appliquer.");
  }

  const result = await applyToFile({ file, documentModel, edits });

  return {
    blob: result.blob,
    filename: reviewedName(file.name),
    report: {
      applied: result.applied.length,
      sentences: edits.length,
      // Never silent: a document presented as corrected that is only
      // three-quarters corrected is worse than one nobody touched.
      notFound: result.notFound,
      skipped: result.skipped ?? [],
      conflicts,
    },
  };
};
