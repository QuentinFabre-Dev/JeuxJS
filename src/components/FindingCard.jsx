import { ArrowRight, FileText, ScanText, ShieldCheck, Zap } from 'lucide-react';
import { PRIORITIES, SKILL_STYLES, SKILLS } from '../data/constants.js';
import { REVIEW_STATES } from '../data/review.js';
import ReviewActions from './ReviewActions.jsx';

const skillLabel = (finding) => {
  if (finding.skill === 'custom') {
    return finding.customLabel ?? 'Custom';
  }
  return SKILLS.find((s) => s.id === finding.skill)?.label ?? finding.skill;
};

/**
 * Compact "table row" style finding entry.
 * Clickable, with a selected state that ties it to the preview.
 * Accept / reject buttons drive the triage state.
 */
export default function FindingCard({
  finding,
  isSelected,
  reviewState = REVIEW_STATES.PENDING,
  onClick,
  onSetReviewState,
}) {
  const priority = PRIORITIES[finding.priority];
  const confidencePct = Math.round(finding.confidence * 100);
  const isAccepted = reviewState === REVIEW_STATES.ACCEPTED;
  const isRejected = reviewState === REVIEW_STATES.REJECTED;
  const isTriaged = isAccepted || isRejected;

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
        isTriaged ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0 p-3.5">
        {/* Meta line */}
        <header className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={[
              `chip ${SKILL_STYLES[finding.skill] ?? SKILL_STYLES.custom}`,
              isRejected ? 'line-through' : '',
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
          {finding.fromOcr && (
            <span
              className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              title="Read by text recognition: the error may come from the scan"
            >
              <ScanText className="h-3 w-3" />
              OCR
            </span>
          )}
          {finding.engine === 'local' && (
            <span
              className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              title="Found by a deterministic check, in this browser: no model, no cost, same answer every time"
            >
              <Zap className="h-3 w-3" />
              Deterministic
            </span>
          )}
          {finding.verdict === 'adjust' && (
            <span
              className="chip bg-violet-50 text-violet-700 ring-1 ring-violet-200"
              title={
                finding.confidenceBefore
                  ? `A second pass revised this: confidence was ${Math.round(finding.confidenceBefore * 100)}%`
                  : 'A second pass revised this finding'
              }
            >
              <ShieldCheck className="h-3 w-3" />
              Revised
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
            Confidence ·{' '}
            <span className="font-semibold text-slate-700">{confidencePct}%</span>
          </span>
          <ReviewActions
            state={reviewState}
            onSet={(target) => onSetReviewState?.(finding.id, target)}
          />
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
                isRejected ? 'line-through' : '',
              ].join(' ')}
            >
              {finding.original}
            </p>
          </div>

          {/* An advisory finding has nothing to put on the right: the fix is a
              decision only the author can make. */}
          {finding.advisory ? null : (
            <>
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
            </>
          )}
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
