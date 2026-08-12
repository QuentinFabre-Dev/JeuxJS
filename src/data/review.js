/**
 * Triage states of a finding.
 *
 * A local model produces false positives, so "I fixed it" and "the model is
 * wrong" must not collapse into a single checkbox: accepted findings are
 * corrections to apply, rejected ones are noise, and only pending findings
 * still weigh on the document score.
 */

export const REVIEW_STATES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export const STATUS_LABELS = {
  [REVIEW_STATES.PENDING]: 'Open',
  [REVIEW_STATES.ACCEPTED]: 'Accepted',
  [REVIEW_STATES.REJECTED]: 'Rejected',
};

export const statusLabel = (state) =>
  STATUS_LABELS[state] ?? STATUS_LABELS[REVIEW_STATES.PENDING];

export const stateOf = (states, id) =>
  states.get(id) ?? REVIEW_STATES.PENDING;

/** Toggling a state twice returns the finding to the pending pile. */
export const toggleState = (states, id, target) => {
  const next = new Map(states);
  if (next.get(id) === target) next.delete(id);
  else next.set(id, target);
  return next;
};
