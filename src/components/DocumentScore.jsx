import { computeDocumentScore } from '../services/mockAnalysisService.js';

const scoreColor = (score) => {
  if (score >= 85) return { label: 'Excellent', text: 'text-emerald-600', ring: 'stroke-emerald-500' };
  if (score >= 70) return { label: 'Bon', text: 'text-sky-600', ring: 'stroke-sky-500' };
  if (score >= 55) return { label: 'Correct', text: 'text-amber-600', ring: 'stroke-amber-500' };
  return { label: 'À retravailler', text: 'text-rose-600', ring: 'stroke-rose-500' };
};

export default function DocumentScore({ findings, isAnalyzing }) {
  const score = computeDocumentScore(findings);
  const { label, text, ring } = scoreColor(score);

  // Cercle SVG : circonférence = 2πr
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="card p-5 flex items-center gap-5">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="fill-none stroke-slate-100"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            className={`fill-none ${ring} transition-[stroke-dashoffset] duration-700 ease-out`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className={`text-xl font-semibold tabular-nums ${text}`}>{score}</p>
            <p className="text-[10px] text-slate-400 -mt-0.5">/ 100</p>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Score qualité du document
        </p>
        <p className={`text-base font-semibold mt-0.5 ${text}`}>{label}</p>
        <p className="text-xs text-slate-500 mt-1 leading-snug">
          {isAnalyzing
            ? 'Le score se met à jour au fil de l\u2019analyse.'
            : `Calculé à partir de ${findings.length} finding${findings.length > 1 ? 's' : ''} détecté${findings.length > 1 ? 's' : ''}.`}
        </p>
      </div>
    </div>
  );
}
