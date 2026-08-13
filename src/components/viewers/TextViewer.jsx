import { useEffect, useRef } from 'react';

import { PRIORITIES } from '../../data/constants.js';
import { REVIEW_STATES, stateOf } from '../../data/review.js';

/**
 * Viewer for plain text and Markdown, and fallback for the demo document.
 *
 * These formats have no layout of their own, so the extracted blocks *are* the
 * document: there is nothing more faithful to render.
 */
export default function TextViewer({
  documentModel,
  findings,
  selectedFindingId,
  onSelectFinding,
  reviewStates,
  zoom,
}) {
  const scrollRef = useRef(null);

  const findingByLocation = new Map();
  findings.forEach((finding) => {
    const key = `${finding.page}::${finding.original}`;
    if (!findingByLocation.has(key)) findingByLocation.set(key, finding);
  });

  useEffect(() => {
    if (!selectedFindingId || !scrollRef.current) return;
    scrollRef.current
      .querySelector(`[data-finding-id="${selectedFindingId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedFindingId]);

  const renderBlock = (block, pageIndex) => {
    if (block.kind === 'heading') {
      return (
        <h4 className="text-sm font-semibold text-slate-900 mt-1 mb-2">
          {block.text}
        </h4>
      );
    }

    const finding = findingByLocation.get(`${pageIndex + 1}::${block.text}`);
    if (!finding) {
      return <p className="text-[13px] leading-relaxed text-slate-600">{block.text}</p>;
    }

    const isSelected = finding.id === selectedFindingId;
    const state = reviewStates
      ? stateOf(reviewStates, finding.id)
      : REVIEW_STATES.PENDING;
    const priority = PRIORITIES[finding.priority];

    return (
      <button
        type="button"
        data-finding-id={finding.id}
        onClick={() => onSelectFinding?.(finding.id)}
        className={[
          'group block w-full text-left rounded-lg transition-all scroll-mt-4',
          'px-2 py-1.5 -mx-2 text-[13px] leading-relaxed',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
          isSelected
            ? 'bg-amber-100 ring-2 ring-amber-400 text-slate-900 shadow-soft'
            : state === REVIEW_STATES.ACCEPTED
              ? 'bg-emerald-50/60 ring-1 ring-emerald-200/70 text-slate-500 line-through hover:bg-emerald-100/70'
              : state === REVIEW_STATES.REJECTED
                ? 'bg-slate-50 ring-1 ring-slate-200 text-slate-400 hover:bg-slate-100'
                : 'bg-amber-50/70 ring-1 ring-amber-200/70 text-slate-700 hover:bg-amber-100/80 hover:ring-amber-300',
        ].join(' ')}
      >
        <span>{block.text}</span>
        <span
          className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${priority.dot}`}
          aria-label={`${priority.label} priority`}
        />
      </button>
    );
  };

  return (
    <div
      ref={scrollRef}
      data-viewer-scroll
      className="flex-1 overflow-auto bg-slate-100 px-4 py-4"
    >
      <div
        className="mx-auto bg-white shadow-card ring-1 ring-slate-200 px-8 py-8"
        style={{ maxWidth: 780 * zoom, fontSize: `${zoom}rem` }}
      >
        {documentModel.pages.map((blocks, pageIndex) => (
          <section key={pageIndex} data-page-number={pageIndex + 1} className="mb-7 last:mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              · Page {pageIndex + 1} ·
            </p>
            <div className="space-y-2">
              {blocks.map((block, index) => (
                <div key={index}>{renderBlock(block, pageIndex)}</div>
              ))}
            </div>
            {pageIndex < documentModel.pages.length - 1 && (
              <div className="mt-7 border-t border-dashed border-slate-200" />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
