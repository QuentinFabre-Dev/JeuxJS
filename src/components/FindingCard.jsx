import { ArrowRight, Check, FileText } from 'lucide-react';
import { PRIORITIES, SKILL_STYLES, SKILLS } from '../data/constants.js';

const skillLabel = (finding) => {
  if (finding.skill === 'custom') {
    return finding.customLabel ?? 'Custom';
  }
  return SKILLS.find((s) => s.id === finding.skill)?.label ?? finding.skill;
};

/**
 * Compact "table row" style finding entry.
 * Clickable, with a selected state that ties it to the preview.
 * A checkbox on the left lets the user mark the finding as resolved.
 */
export default function FindingCard({
  finding,
  isSelected,
  isResolved,
  onClick,
  onToggleResolved,
}) {
  const priority = PRIORITIES[finding.priority];
  const confidencePct = Math.round(finding.confidence * 100);

  return (
    <article
      data-finding-id={finding.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={[
        'relative card animate-fade-in-up cursor-pointer transition-all scroll-mt-4',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        'flex items-stretch overflow-hidden',
        isSelected
          ? 'ring-2 ring-brand-500 shadow-card'
          : 'hover:shadow-card hover:border-slate-300/80',
        isResolved ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Priority rail */}
      <span
        className={`w-1 shrink-0 ${priority.bar}`}
        aria-hidden
      />

      <div className="flex-1 min-w-0 p-3.5">
        {/* Meta line */}
        <header className="flex flex-wrap items-center gap-2 mb-2">
          {/* Resolve checkbox */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleResolved?.(finding.id);
            }}
            aria-label={isResolved ? 'Mark as unresolved' : 'Mark as resolved'}
            aria-pressed={isResolved}
            className={[
              'h-4 w-4 rounded border grid place-items-center shrink-0 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
              isResolved
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-white border-slate-300 hover:border-brand-400',
            ].join(' ')}
          >
            {isResolved && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>

          <span
            className={[
              `chip ${SKILL_STYLES[finding.skill] ?? SKILL_STYLES.custom}`,
              isResolved ? 'line-through' : '',
            ].join(' ')}
          >
            {skillLabel(finding)}
          </span>
          <span className={`chip ${priority.classes}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>
          <span className="chip bg-slate-50 text-slate-600 ring-1 ring-slate-200">
            <FileText className="h-3 w-3" />
            p. {finding.page}
          </span>
          <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
            Confidence ·{' '}
            <span className="font-semibold text-slate-700">{confidencePct}%</span>
          </span>
        </header>

        {/* Original → Suggestion (two-column layout) */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div className="rounded-lg bg-slate-50/80 ring-1 ring-slate-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
              Original
            </p>
            <p
              className={[
                'text-[13px] text-slate-800 leading-snug',
                isResolved ? 'line-through' : '',
              ].join(' ')}
            >
              {finding.original}
            </p>
          </div>

          <div className="hidden md:flex items-center justify-center pt-5">
            <ArrowRight className="h-4 w-4 text-slate-300" />
          </div>

          <div className="rounded-lg bg-emerald-50/70 ring-1 ring-emerald-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80 mb-0.5">
              Suggestion
            </p>
            <p className="text-[13px] text-emerald-900 leading-snug">
              {finding.suggestion}
            </p>
          </div>
        </div>

        {finding.explanation && (
          <p className="mt-2 text-[11px] text-slate-500 leading-snug">
            <span className="font-semibold text-slate-600">Why:</span>{' '}
            {finding.explanation}
          </p>
        )}
      </div>
    </article>
  );
}
