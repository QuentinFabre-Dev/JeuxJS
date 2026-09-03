/**
 * Scoring a review against an annotated document.
 *
 * A finding matches an expectation when it lands on the **same sentence** for
 * the **same skill**. Matching on the sentence alone would credit a reviewer
 * that found the right sentence for the wrong reason; matching on the wording
 * of the explanation would score prose rather than detection.
 *
 * Precision matters more than recall here, and the report says so: a document
 * cleared by a tool that missed something is annoying, a document cluttered
 * with false positives is a tool nobody opens twice.
 */
export const scoreFindings = (findings, expected) => {
  const key = (item) => `${item.id ?? item.sentenceId}::${item.skill}`;
  const wanted = new Set(expected.map(key));
  const found = new Set(findings.map(key));

  const truePositives = [...found].filter((entry) => wanted.has(entry));
  const falsePositives = [...found].filter((entry) => !wanted.has(entry));
  const missed = [...wanted].filter((entry) => !found.has(entry));

  const precision = found.size ? truePositives.length / found.size : 1;
  const recall = wanted.size ? truePositives.length / wanted.size : 1;

  return {
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    truePositives: truePositives.length,
    falsePositives,
    missed,
  };
};

export const percent = (ratio) => `${Math.round(ratio * 100)}%`;
