/**
 * The sample deliverable and its statement of work.
 *
 * They are served as real files and go through the normal upload path — the
 * same parser, the same anchors, the same checks. A demo that bypassed the
 * pipeline would demonstrate the pipeline working when it does not.
 *
 * The pair is written to exercise the whole product: the deliverable carries a
 * misspelling, an agreement error, a sentence nobody reads twice by choice, an
 * acronym used two sections before it is defined, two dates in two formats and
 * one amount written two ways — and it breaks its own statement of work in
 * three different manners.
 */
export const SAMPLES = {
  document: {
    path: '/samples/rapport-exemple.md',
    name: 'rapport-exemple.md',
    label: 'Audit de sécurité — Northwind (exemple)',
  },
  sow: {
    path: '/samples/sow-exemple.md',
    name: 'sow-exemple.md',
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

  return new File([await response.blob()], sample.name, { type: 'text/markdown' });
};
