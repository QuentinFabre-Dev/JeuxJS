import { PRIORITIES } from '../data/constants.js';

/**
 * Horizontal stacked bar chart showing the priority distribution
 * across all findings (high / medium / low).
 */
export default function PriorityDistribution({ findings }) {
  const total = findings.length;
  const order = ['high', 'medium', 'low'];

  const counts = order.map((id) => ({
    ...PRIORITIES[id],
    count: findings.filter((f) => f.priority === id).length,
  }));

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Priority distribution
        </p>
        <span className="text-[11px] text-slate-400 tabular-nums">
          {total} finding{total > 1 ? 's' : ''}
        </span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-slate-400 flex-1 grid place-items-center">
          No findings yet
        </p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
            {counts.map((p) => {
              const pct = (p.count / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={p.id}
                  className={`${p.bar} transition-[width] duration-500 ease-out`}
                  style={{ width: `${pct}%` }}
                  title={`${p.label}: ${p.count}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {counts.map((p) => {
              const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {p.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-semibold text-slate-900 tabular-nums">
                      {p.count}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
