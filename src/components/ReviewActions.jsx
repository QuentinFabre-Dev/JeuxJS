import { Check, Undo2, X } from 'lucide-react';

import { REVIEW_STATES } from '../data/review.js';

/**
 * Accept / reject buttons for a finding.
 * Clicking the active state again returns the finding to the open pile.
 */
export default function ReviewActions({ state, onSet, size = 'md' }) {
  const isAccepted = state === REVIEW_STATES.ACCEPTED;
  const isRejected = state === REVIEW_STATES.REJECTED;
  const pad = size === 'sm' ? 'h-6 px-1.5' : 'h-7 px-2';

  const button = (target, active, activeClasses, Icon, label) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSet(target);
      }}
      aria-pressed={active}
      title={active ? `${label} — click to reopen` : label}
      className={[
        pad,
        'inline-flex items-center gap-1 rounded-lg text-[11px] font-medium ring-1 transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        active
          ? activeClasses
          : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 hover:text-slate-700',
      ].join(' ')}
    >
      {active ? <Undo2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 shrink-0">
      {button(
        REVIEW_STATES.ACCEPTED,
        isAccepted,
        'bg-emerald-500 text-white ring-emerald-500',
        Check,
        'Accept'
      )}
      {button(
        REVIEW_STATES.REJECTED,
        isRejected,
        'bg-slate-600 text-white ring-slate-600',
        X,
        'Reject'
      )}
    </div>
  );
}
