import { Loader2 } from 'lucide-react';

export default function AnalysisProgress({ progress, count }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="card p-5 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-3">
        <Loader2 className="h-4 w-4 text-brand-600 animate-spin" />
        <p className="text-sm font-medium text-slate-900">
          Analyse en cours…
        </p>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">
          {pct}% · {count} finding{count > 1 ? 's' : ''}
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
