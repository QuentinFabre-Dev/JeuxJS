/**
 * What a review will cost and how long it will take, before it is launched.
 *
 * The point of the check registry is that a decision the user makes — ticking
 * one skill rather than five — has a visible price. That is only true if the
 * price is shown *before* the run, next to the switch that changes it.
 *
 * Duration is bounded the way a bounded pool actually behaves: no review is
 * faster than its slowest single call, and none is faster than the total call
 * time divided by the number of calls in flight. Taking the larger of the two
 * is a rough figure, and it is the honest one — measuring it is batch F's job.
 */
import { PROMPT_OVERHEAD, TOKENS_PER_PAGE, checkById } from './registry.js';
import { costOf, modelFor } from './pricing.js';

const tokensFor = (check, task) => {
  const inputTokens =
    check.scope === 'document'
      ? (check.inputTokens ?? 0)
      : PROMPT_OVERHEAD + (task.pages?.length ?? 1) * TOKENS_PER_PAGE;
  return { inputTokens, outputTokens: check.outputTokens ?? 0 };
};

/**
 * @param {object[]} tasks     from `planTasks`
 * @param {object}   [options]
 * @param {number}   [options.concurrency=12] calls in flight at once
 * @returns {{seconds:number, dollars:number, calls:number, free:number,
 *            byModel:Record<string,{calls:number,dollars:number}>}}
 */
export const estimateReview = (tasks, { concurrency = 12 } = {}) => {
  let totalCallSeconds = 0;
  let slowestCall = 0;
  let localSeconds = 0;
  let dollars = 0;
  let calls = 0;
  let free = 0;
  const byModel = {};

  for (const task of tasks) {
    const check = checkById(task.check);
    if (!check) continue;

    if (check.engine === 'local') {
      // The deterministic checks run in a worker while the calls are in
      // flight, so they add nothing to the wall clock unless they are alone.
      localSeconds = Math.max(localSeconds, check.localSeconds ?? 0);
      free += 1;
      continue;
    }

    const tokens = tokensFor(check, task);
    const model = modelFor(check.model);
    const seconds = model.firstTokenSeconds + tokens.outputTokens / model.outputTokensPerSecond;

    totalCallSeconds += seconds;
    slowestCall = Math.max(slowestCall, seconds);
    calls += 1;

    const cost = costOf(check.model, tokens);
    dollars += cost;

    const bucket = (byModel[model.label] ??= { calls: 0, dollars: 0 });
    bucket.calls += 1;
    bucket.dollars += cost;
  }

  const seconds = calls
    ? Math.max(slowestCall, totalCallSeconds / Math.max(1, concurrency))
    : localSeconds;

  return { seconds, dollars, calls, free, byModel };
};

/** "≈ 20 s" / "≈ 2 min" — the interface needs a phrase, not a float. */
export const formatDuration = (seconds) => {
  if (seconds < 1) return '< 1 s';
  if (seconds < 90) return `≈ ${Math.round(seconds)} s`;
  return `≈ ${Math.round(seconds / 60)} min`;
};

/** "free" / "≈ $0.03" — below a cent, a price in dollars says nothing useful. */
export const formatCost = (dollars) => {
  if (dollars <= 0) return 'free';
  if (dollars < 0.01) return '< $0.01';
  return `≈ $${dollars.toFixed(2)}`;
};
