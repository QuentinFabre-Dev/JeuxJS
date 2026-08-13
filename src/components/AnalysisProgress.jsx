import { Loader2 } from 'lucide-react';

/** "2 min" / "45 s" — a rough remaining time is enough to stop guessing. */
const formatEta = (ms) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds < 10) return 'a few seconds left';
  if (seconds < 90) return `~${seconds} s left`;
  return `~${Math.round(seconds / 60)} min left`;
};

export default function AnalysisProgress({ progress, count }) {
  const { ratio = 0, step, stepCount, label, etaMs } = progress ?? {};
  const pct = Math.round(ratio * 100);
  const eta = formatEta(etaMs);

  return (
    <div className="card p-5 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-3">
        <Loader2 className="h-4 w-4 text-brand-600 animate-spin" />
        <p className="text-sm font-medium text-slate-900">
          Analysis in progress…
        </p>
        {label && (
          <span className="text-xs text-slate-500 truncate">{label}</span>
        )}
        <span className="ml-auto text-xs text-slate-500 tabular-nums shrink-0">
          {stepCount ? `${step}/${stepCount} · ` : ''}
          {pct}% · {count} finding{count > 1 ? 's' : ''}
          {eta ? ` · ${eta}` : ''}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
