import { Loader2, RotateCw } from 'lucide-react';

import { SKILLS, SKILL_STYLES } from '../data/constants.js';

/**
 * Findings count per skill, displayed as a tidy list of chips.
 * Custom user-defined checks are aggregated under a single row.
 * Each built-in check can be re-run on its own, so tightening one criterion
 * does not mean paying for a full re-analysis.
 */
export default function SkillCounts({ findings, onRerunSkill, rerunningSkill }) {
  const baseRows = SKILLS.map((s) => ({
    ...s,
    count: findings.filter((f) => f.skill === s.id).length,
  }));

  const customCount = findings.filter((f) => f.skill === 'custom').length;
  const rows =
    customCount > 0
      ? [
          ...baseRows,
          { id: 'custom', label: 'Custom', count: customCount },
        ]
      : baseRows;

  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          By type
        </p>
        <span className="text-[11px] text-slate-400">
          {rows.filter((r) => r.count > 0).length} of {rows.length} active
        </span>
      </div>

      <div className="space-y-2 flex-1">
        {rows.map((row) => {
          const pct = (row.count / max) * 100;
          return (
            <div key={row.id} className="flex items-center gap-3">
              <span className={`chip ${SKILL_STYLES[row.id]} shrink-0 min-w-[96px] justify-center`}>
                {row.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-500/70 transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900 tabular-nums w-5 text-right">
                {row.count}
              </span>
              {onRerunSkill && row.id !== 'custom' && (
                <button
                  type="button"
                  onClick={() => onRerunSkill(row.id)}
                  disabled={!!rerunningSkill}
                  className="text-slate-300 hover:text-brand-600 disabled:opacity-40
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
                  title={`Re-run the ${row.label} check`}
                  aria-label={`Re-run the ${row.label} check`}
                >
                  {rerunningSkill === row.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
