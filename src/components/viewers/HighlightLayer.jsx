import { PRIORITIES } from '../../data/constants.js';
import { REVIEW_STATES, stateOf } from '../../data/review.js';

/**
 * Clickable highlights laid over a rendered page.
 *
 * Positions come from the anchors kept at extraction time, expressed at scale 1,
 * so the layer only has to multiply by the current render scale.
 */
const area = (finding) =>
  (finding.rects ?? []).reduce((total, rect) => total + rect.width * rect.height, 0);

export default function HighlightLayer({
  findings,
  scale,
  selectedFindingId,
  onSelectFinding,
  reviewStates,
}) {
  // Big highlights first: a small one sitting on the same line would otherwise
  // be covered by its neighbour and become unclickable.
  const ordered = [...findings].sort((a, b) => area(b) - area(a));

  return (
    <div className="absolute inset-0">
      {ordered.map((finding) =>
        (finding.rects ?? []).map((rect, index) => {
          const isSelected = finding.id === selectedFindingId;
          const state = reviewStates
            ? stateOf(reviewStates, finding.id)
            : REVIEW_STATES.PENDING;
          const priority = PRIORITIES[finding.priority];

          return (
            <button
              key={`${finding.id}-${index}`}
              type="button"
              data-finding-id={index === 0 ? finding.id : undefined}
              onClick={() => onSelectFinding?.(finding.id)}
              title={finding.explanation}
              aria-label={`${priority?.label ?? ''} finding: ${finding.original}`}
              className={[
                'absolute rounded-[3px] transition-all cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                isSelected
                  ? 'bg-amber-300/50 ring-2 ring-amber-500 shadow-sm'
                  : state === REVIEW_STATES.ACCEPTED
                    ? 'bg-emerald-300/25 ring-1 ring-emerald-400/60 hover:bg-emerald-300/40'
                    : state === REVIEW_STATES.REJECTED
                      ? 'bg-slate-300/20 ring-1 ring-slate-300 hover:bg-slate-300/30'
                      : 'bg-amber-200/35 ring-1 ring-amber-400/50 hover:bg-amber-200/60',
              ].join(' ')}
              style={{
                // A couple of pixels of padding keeps descenders inside.
                zIndex: isSelected ? 2 : 1,
                left: rect.left * scale - 1,
                top: rect.top * scale - 1,
                width: rect.width * scale + 2,
                height: rect.height * scale + 2,
              }}
            />
          );
        })
      )}
    </div>
  );
}
