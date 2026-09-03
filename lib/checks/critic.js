/**
 * The verification pass.
 *
 * The first answer is not the final answer: a candidate is a claim, and the
 * cost this tool is supposed to remove is the reader sorting true claims from
 * false ones. So a second call challenges the arguable ones.
 *
 * The loop is **bounded by construction**: one verification pass, no retry
 * decided by a model. Left free, a critic that keeps asking itself questions
 * burns the budget without a stopping rule.
 *
 * The critic never sees the first reviewer's reasoning — only the sentence and
 * the claim. Shown the reasoning, it approves by mimicry.
 */

export const POLICIES = {
  // Nothing is verified: the fastest and cheapest, the historical behaviour.
  off: () => false,
  // The default. Below 0.8 the model was unsure; a `high` priority is worth a
  // second look precisely because it is what the reader will act on first.
  uncertain: (candidate) =>
    Number(candidate.confidence ?? 0) < 0.8 || candidate.priority === 'high',
  // Everything, the most expensive.
  all: () => true,
};

export const DEFAULT_POLICY = 'uncertain';

/** Candidates a policy sends to verification. */
export const toVerify = (candidates, policy = DEFAULT_POLICY) => {
  const predicate = POLICIES[policy] ?? POLICIES[DEFAULT_POLICY];
  return candidates.filter(predicate);
};

/** Candidates are verified in packets: one call per dozen, not one per claim. */
export const CRITIC_BATCH = 12;

export const batchCandidates = (candidates, size = CRITIC_BATCH) => {
  const batches = [];
  for (let i = 0; i < candidates.length; i += size) {
    batches.push(candidates.slice(i, i + size));
  }
  return batches;
};

export const VERDICTS_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The candidate reference, copied exactly.' },
          verdict: { type: 'string', enum: ['keep', 'drop', 'adjust'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reason: { type: 'string' },
        },
        required: ['id', 'verdict', 'priority', 'confidence', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
};

/** What the critic is shown: the sentence and the claim, never the reasoning. */
export const formatCandidates = (candidates, sentenceOf) =>
  candidates
    .map((candidate, index) => {
      const original = sentenceOf(candidate.id) ?? '';
      return [
        `[c${index}]`,
        `check: ${candidate.skill}${candidate.custom_label ? ` (${candidate.custom_label})` : ''}`,
        `original: ${original}`,
        `suggestion: ${candidate.suggestion}`,
        `claim: ${candidate.explanation}`,
        `stated priority: ${candidate.priority}`,
      ].join('\n');
    })
    .join('\n\n');

/**
 * Turns verdicts into one decision per candidate.
 *
 * Decisions are streamed to the interface, which already shows the candidate:
 * a `drop` removes the card, an `adjust` moves its priority and confidence,
 * a `keep` just stamps it as verified.
 *
 * @returns {{ref: string, verdict: string, priority?: string,
 *            confidence?: number, confidenceBefore?: number,
 *            reason?: string}[]}
 */
export const applyVerdicts = (candidates, verdicts) => {
  const byRef = new Map(verdicts.map((verdict) => [verdict.id, verdict]));

  return candidates.map((candidate, index) => {
    const verdict = byRef.get(`c${index}`);

    // No verdict is not a rejection: a critic that answers short must never
    // silently delete findings.
    if (!verdict) return { ref: candidate.ref, verdict: 'unverified' };
    if (verdict.verdict === 'drop') {
      return { ref: candidate.ref, verdict: 'drop', reason: verdict.reason };
    }
    if (verdict.verdict === 'keep') {
      return { ref: candidate.ref, verdict: 'keep', reason: verdict.reason };
    }

    return {
      ref: candidate.ref,
      verdict: 'adjust',
      priority: verdict.priority ?? candidate.priority,
      confidence: verdict.confidence ?? candidate.confidence,
      confidenceBefore: candidate.confidence,
      reason: verdict.reason,
    };
  });
};

/** The share of candidates a critic rejected — a critic at 0 % is useless. */
export const dropRate = (decisions) =>
  decisions.length
    ? decisions.filter((decision) => decision.verdict === 'drop').length / decisions.length
    : 0;
