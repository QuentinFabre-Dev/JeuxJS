/**
 * The document, flattened into the sentences a check reasons about.
 *
 * Every sentence carries the id the model must answer with (`p3s7`) instead of
 * rewriting the text: the sentence shown in the interface is therefore always
 * the exact sentence extracted from the file, which is what keeps the
 * highlighting reliable when the model paraphrases.
 *
 * Shared by both sides — the browser runs the deterministic checks on this
 * shape, the server builds its prompts from it — so a numbering drift between
 * the two is impossible by construction.
 */
export const documentSentences = (documentModel) => {
  const sentences = [];
  documentModel.pages.forEach((blocks, pageIndex) => {
    blocks.forEach((block, blockIndex) => {
      if (block.kind !== 'p') return;
      sentences.push({
        id: `p${pageIndex + 1}s${blockIndex + 1}`,
        page: pageIndex + 1,
        text: block.text,
      });
    });
  });
  return sentences;
};

/** Headings, as context for the document-scope checks. */
export const documentHeadings = (documentModel) =>
  documentModel.pages.flatMap((blocks, pageIndex) =>
    blocks
      .filter((block) => block.kind === 'heading')
      .map((block) => ({ page: pageIndex + 1, text: block.text }))
  );

/**
 * The document stripped of what only the browser needs.
 *
 * Rectangles are anchors for the viewer; sending them to the server would
 * triple the payload for data no prompt ever reads.
 */
export const forTransport = (documentModel) => ({
  pages: documentModel.pages.map((blocks) =>
    blocks.map(({ kind, text }) => ({ kind, text }))
  ),
});

/**
 * The sentences a cross-page check should look at.
 *
 * The whole document never fits, and sending it padded out with prose that
 * cannot contradict anything wastes the budget. Sentences carrying a figure,
 * an acronym or a capitalised term come first — they are the ones that can
 * disagree with a distant page — then reading order fills the rest.
 */
export const consistencyCandidates = (sentences, limit = 120) => {
  const carriesFact = (text) => /\d/.test(text) || /\b[A-Z][A-Z0-9]{1,6}\b/.test(text);
  const factual = sentences.filter((sentence) => carriesFact(sentence.text));
  if (factual.length >= limit) return factual.slice(0, limit);

  const chosen = new Set(factual.map((sentence) => sentence.id));
  for (const sentence of sentences) {
    if (chosen.size >= limit) break;
    chosen.add(sentence.id);
  }
  return sentences.filter((sentence) => chosen.has(sentence.id));
};
