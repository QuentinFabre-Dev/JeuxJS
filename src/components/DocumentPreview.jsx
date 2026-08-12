import { useEffect, useMemo, useRef } from 'react';
import { FileText, Sparkles } from 'lucide-react';

import { MOCK_DOCUMENT } from '../data/mockDocument.js';
import { PRIORITIES } from '../data/constants.js';

/**
 * Paginated preview of the analyzed document.
 * Sentences that match a finding are highlighted and clickable.
 * When a finding is selected (from the list OR from this component),
 * the preview auto-scrolls to the matching sentence.
 */
export default function DocumentPreview({
  documentModel,
  findings,
  selectedFindingId,
  onSelectFinding,
  resolvedIds,
}) {
  const scrollRef = useRef(null);

  // Real uploaded document when available, mocked one in demo mode.
  const doc = documentModel ?? MOCK_DOCUMENT;

  // Index "page::text" → finding (first match wins on collision).
  const findingByLocation = useMemo(() => {
    const map = new Map();
    findings.forEach((f) => {
      const key = `${f.page}::${f.original}`;
      if (!map.has(key)) map.set(key, f);
    });
    return map;
  }, [findings]);

  // Auto-scroll to the selected sentence.
  useEffect(() => {
    if (!selectedFindingId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-finding-id="${selectedFindingId}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedFindingId]);

  const renderBlock = (block, pageIdx) => {
    if (block.kind === 'heading') {
      return (
        <h4 className="text-sm font-semibold text-slate-900 mt-1 mb-2">
          {block.text}
        </h4>
      );
    }

    const finding = findingByLocation.get(`${pageIdx + 1}::${block.text}`);

    if (!finding) {
      return (
        <p className="text-[13px] leading-relaxed text-slate-600">
          {block.text}
        </p>
      );
    }

    const isSelected = finding.id === selectedFindingId;
    const isResolved = resolvedIds?.has(finding.id);
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
            : isResolved
            ? 'bg-emerald-50/60 ring-1 ring-emerald-200/70 text-slate-500 line-through hover:bg-emerald-100/70'
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
    <div className="card overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[480px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center">
          <FileText className="h-4 w-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {doc.title}
          </p>
          <p className="text-[11px] text-slate-500 -mt-0.5 truncate">
            {doc.subtitle}
          </p>
        </div>
        <span className="chip bg-slate-50 text-slate-500 ring-1 ring-slate-200 shrink-0">
          {doc.pages.length} pages
        </span>
      </div>

      {/* Pages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
        {doc.pages.map((blocks, pageIdx) => (
          <section key={pageIdx} className="mb-7 last:mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              · Page {pageIdx + 1} ·
            </p>
            <div className="space-y-2">
              {blocks.map((block, i) => (
                <div key={i}>{renderBlock(block, pageIdx)}</div>
              ))}
            </div>
            {pageIdx < doc.pages.length - 1 && (
              <div className="mt-7 border-t border-dashed border-slate-200" />
            )}
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 flex items-center gap-2 shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-brand-500" />
        {findings.length === 0
          ? 'Analyzed sentences will light up here as they come in.'
          : 'Click a sentence or a finding to link them together.'}
      </div>
    </div>
  );
}
