import { MOCK_FINDINGS_POOL } from '../data/mockFindings.js';

/**
 * Simple unique id generator.
 */
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Fisher-Yates shuffle.
 */
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Adds a small random jitter to the confidence score so that two
 * runs never produce exactly the same values.
 */
const jitterConfidence = (base) => {
  const delta = (Math.random() - 0.5) * 0.06;
  return Math.max(0.55, Math.min(0.99, base + delta));
};

/**
 * Builds the run plan based on the selected skills.
 * The document type slightly boosts the confidence of the most
 * relevant skill (without duplicating findings, so the 1:1 mapping
 * with the document preview is preserved).
 */
const buildRunPlan = ({ skills, docType }) => {
  const filtered = MOCK_FINDINGS_POOL.filter((f) => skills.includes(f.skill));

  const boostMap = {
    email: 'tone',
    procedure: 'consistency',
    policy: 'clarity',
    report: 'grammar',
  };
  const boostedSkill = boostMap[docType];

  return shuffle(filtered).map((f) => {
    const base = jitterConfidence(f.confidence);
    const boosted = f.skill === boostedSkill ? Math.min(0.99, base + 0.04) : base;
    return {
      ...f,
      id: uid(),
      confidence: Number(boosted.toFixed(2)),
    };
  });
};

/**
 * Main service: simulates a "streaming" analysis call.
 *
 * @param {Object}   options
 * @param {Object}   options.file        Uploaded file (mocked)
 * @param {string[]} options.skills      Enabled skill ids
 * @param {string}   options.docType     Document type id
 * @param {Function} options.onFinding   Callback invoked for each finding
 * @param {Function} options.onProgress  Progress callback (0..1)
 * @param {Function} options.onComplete  Completion callback (summary)
 * @param {AbortSignal} [options.signal] Cancellation signal
 *
 * @returns {Promise<void>}
 */
export const runMockAnalysis = ({
  file,
  skills,
  docType,
  onFinding,
  onProgress,
  onComplete,
  signal,
}) => {
  return new Promise((resolve) => {
    const findings = buildRunPlan({ skills, docType });
    const total = findings.length;
    let index = 0;

    if (total === 0) {
      onProgress?.(1);
      onComplete?.({ findings: [], score: 100 });
      resolve();
      return;
    }

    // Small initial delay to simulate "model warming up".
    const initialDelay = 600;

    const emitNext = () => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      if (index >= total) {
        const score = computeDocumentScore(findings);
        onProgress?.(1);
        onComplete?.({ findings, score });
        resolve();
        return;
      }

      const finding = findings[index];
      onFinding?.(finding);
      index += 1;
      onProgress?.(index / total);

      // Random delay between 250 and 850 ms between two findings.
      const nextDelay = 250 + Math.random() * 600;
      setTimeout(emitNext, nextDelay);
    };

    setTimeout(emitNext, initialDelay);
  });
};

/**
 * Computes a global document score (0-100) from a list of findings.
 * High-priority findings weigh more than low-priority ones.
 */
export const computeDocumentScore = (findings) => {
  if (!findings || findings.length === 0) return 100;

  const weights = { high: 6, medium: 3, low: 1 };
  const penalty = findings.reduce(
    (sum, f) => sum + (weights[f.priority] ?? 1),
    0
  );

  // Start from 100, subtract the penalty, clamp at 40 minimum.
  const score = Math.max(40, 100 - Math.min(penalty, 60));
  return Math.round(score);
};
