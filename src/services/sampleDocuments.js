/**
 * The sample deliverable and its statement of work.
 *
 * They are real Word files, not approximations: `.docx` is the format this
 * tool meets every working day, and a sample that does not look like real work
 * demonstrates nothing. They are served as files and go through the normal
 * upload path — the same parser, the same anchors, the same checks, the same
 * regeneration. A demo that bypassed the pipeline would demonstrate a pipeline
 * working when it does not.
 *
 * `npm run build:samples` rebuilds them from `scripts/build-samples.mjs`.
 *
 * The pair is written to exercise the whole product: the deliverable carries a
 * misspelling, an agreement error, a sentence nobody reads twice by choice, an
 * acronym used two sections before it is defined, two dates in two formats and
 * one amount written two ways — and it breaks its own statement of work in
 * three different manners.
 */
export const SAMPLES = {
  document: {
    path: '/samples/rapport-exemple.docx',
    name: 'rapport-exemple.docx',
    label: 'Audit de sécurité — Northwind (exemple)',
  },
  sow: {
    path: '/samples/sow-exemple.docx',
    name: 'sow-exemple.docx',
    label: 'SoW Northwind (exemple)',
  },
};

/** Fetches a sample and hands back a real `File`, as if it had been dropped. */
export const loadSample = async (key) => {
  const sample = SAMPLES[key];
  if (!sample) throw new Error(`Exemple inconnu : ${key}`);

  const response = await fetch(sample.path);
  if (!response.ok) {
    throw new Error("L'exemple n'a pas pu être chargé.");
  }

  return new File([await response.blob()], sample.name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};
