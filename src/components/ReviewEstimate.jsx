import { Cloud, Zap } from 'lucide-react';

import { planTasks } from '../../lib/checks/planner.js';
import { checksForSkills } from '../../lib/checks/registry.js';
import {
  estimateReview,
  formatCost,
  formatDuration,
} from '../../lib/checks/estimate.js';
import { modelFor } from '../../lib/checks/pricing.js';

/**
 * What this review will cost, shown before it is launched.
 *
 * Ticking one type rather than five has a price, and the only moment that
 * price is useful is next to the switch that changes it. Free and instant
 * checks are marked as such: they are the reason a spelling-only pass is not
 * the same product as a full review.
 */
export default function ReviewEstimate({ skills, customChecks = [], pageCount }) {
  if (!pageCount) return null;

  const selection = [...skills, ...(customChecks.length ? ['custom'] : [])];
  const checks = checksForSkills(selection);
  const tasks = planTasks({ skills: selection, pageCount });
  const total = estimateReview(tasks);

  if (!checks.length) {
    return (
      <p className="text-[11px] text-slate-400">
        Nothing selected — pick at least one analysis type.
      </p>
    );
  }

  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <ul className="space-y-1.5">
        {checks.map((check) => {
          const own = estimateReview(tasks.filter((task) => task.check === check.id));
          const local = check.engine === 'local';
          return (
            <li key={check.id} className="flex items-center gap-2 text-[11px]">
              {local ? (
                <Zap className="h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <Cloud className="h-3 w-3 shrink-0 text-slate-400" />
              )}
              <span className="font-medium text-slate-700">{check.label}</span>
              <span className="text-slate-400">
                {local ? 'in this browser' : modelFor(check.model).label}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-slate-500">
                {formatDuration(own.seconds)} · {formatCost(own.dollars)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-2.5 flex items-center gap-2 border-t border-slate-200 pt-2 text-[11px]">
        <span className="font-semibold text-slate-900">Estimated</span>
        <span className="text-slate-400">
          {pageCount} page{pageCount > 1 ? 's' : ''} · {total.calls} model call
          {total.calls === 1 ? '' : 's'}
        </span>
        <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-900">
          {formatDuration(total.seconds)} · {formatCost(total.dollars)}
        </span>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        An estimate, not a quote: the real figures are reported at the end of
        the review.
      </p>
    </div>
  );
}
