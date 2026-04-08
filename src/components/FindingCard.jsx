import { ArrowRight, FileText } from 'lucide-react';
import { PRIORITIES, SKILL_STYLES, SKILLS } from '../data/constants.js';

const skillLabel = (id) => SKILLS.find((s) => s.id === id)?.label ?? id;

export default function FindingCard({ finding }) {
  const priority = PRIORITIES[finding.priority];
  const confidencePct = Math.round(finding.confidence * 100);

  return (
    <article className="card p-5 animate-fade-in-up hover:shadow-card transition-shadow">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`chip ${SKILL_STYLES[finding.skill]}`}>
          {skillLabel(finding.skill)}
        </span>
        <span className={`chip ${priority.classes}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
          Priorité {priority.label.toLowerCase()}
        </span>
        <span className="chip bg-slate-50 text-slate-600 ring-1 ring-slate-200">
          <FileText className="h-3 w-3" />
          Page {finding.page}
        </span>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">
          Confiance · <span className="font-medium text-slate-700">{confidencePct}%</span>
        </span>
      </header>

      {/* Original */}
      <div className="rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1">
          Phrase originale
        </p>
        <p className="text-sm text-slate-800 leading-relaxed">
          {finding.original}
        </p>
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center my-2">
        <ArrowRight className="h-4 w-4 text-slate-300" />
      </div>

      {/* Suggestion */}
      <div className="rounded-xl bg-emerald-50/60 ring-1 ring-emerald-100 p-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80 mb-1">
          Suggestion
        </p>
        <p className="text-sm text-emerald-900 leading-relaxed">
          {finding.suggestion}
        </p>
      </div>

      {finding.explanation && (
        <p className="mt-3 text-xs text-slate-500 leading-relaxed">
          <span className="font-medium text-slate-600">Explication :</span>{' '}
          {finding.explanation}
        </p>
      )}
    </article>
  );
}
