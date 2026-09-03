import { Receipt } from 'lucide-react';

import { actualCost, formatCost } from '../../lib/checks/estimate.js';

/**
 * What the review actually consumed.
 *
 * The estimate shown before the run is a promise; this is the receipt. Showing
 * only the first would make the figure impossible to trust, and impossible to
 * correct.
 */
export default function ReviewCost({ usage }) {
  if (!usage || !Object.keys(usage).length) return null;
  const real = actualCost(usage);
  if (!real.inputTokens && !real.outputTokens) return null;

  const cachedShare = real.inputTokens
    ? Math.round((real.cachedInputTokens / real.inputTokens) * 100)
    : 0;

  return (
    <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <Receipt className="h-3 w-3" />
      This review cost {formatCost(real.dollars)} —{' '}
      {real.inputTokens.toLocaleString()} in / {real.outputTokens.toLocaleString()} out
      {cachedShare > 0 ? `, ${cachedShare}% of input served from cache` : ''}
    </p>
  );
}
