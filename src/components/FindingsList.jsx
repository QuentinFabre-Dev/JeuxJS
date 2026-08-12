import { useEffect, useRef } from 'react';
import { Inbox } from 'lucide-react';

import FindingCard from './FindingCard.jsx';
import { REVIEW_STATES, stateOf } from '../data/review.js';

/**
 * Findings list with keyboard triage.
 *
 * j / k (or ↓ / ↑) move through the list, a accepts, r rejects, Escape
 * deselects — going through forty findings with the mouse is the slow part of
 * a review.
 */
export default function FindingsList({
  findings,
  isAnalyzing,
  selectedFindingId,
  onSelectFinding,
  reviewStates,
  onSetReviewState,
}) {
  const containerRef = useRef(null);

  // Auto-scroll to the selected card (when the selection comes
  // from the document preview rather than from the list itself).
  useEffect(() => {
    if (!selectedFindingId || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-finding-id="${selectedFindingId}"]`
    );
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedFindingId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!findings.length) return;
      // Never hijack typing in the custom-check field or the settings dialog.
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const index = findings.findIndex((f) => f.id === selectedFindingId);

      const move = (delta) => {
        event.preventDefault();
        const next =
          index === -1
            ? 0
            : Math.min(findings.length - 1, Math.max(0, index + delta));
        onSelectFinding?.(findings[next].id);
      };

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          return move(1);
        case 'k':
        case 'ArrowUp':
          return move(-1);
        case 'a':
          if (index === -1) return undefined;
          event.preventDefault();
          return onSetReviewState?.(findings[index].id, REVIEW_STATES.ACCEPTED);
        case 'r':
          if (index === -1) return undefined;
          event.preventDefault();
          return onSetReviewState?.(findings[index].id, REVIEW_STATES.REJECTED);
        case 'Escape':
          return onSelectFinding?.(null);
        default:
          return undefined;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [findings, selectedFindingId, onSelectFinding, onSetReviewState]);

  if (findings.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 grid place-items-center mb-3">
          <Inbox className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          {isAnalyzing ? 'Waiting for first results…' : 'No findings to display'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {isAnalyzing
            ? 'Anomalies will appear here as soon as they are detected.'
            : 'Adjust your filters to see more results.'}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Screen readers get told that results are streaming in. */}
      <p className="sr-only" aria-live="polite">
        {findings.length} finding{findings.length > 1 ? 's' : ''} displayed.
      </p>

      <div ref={containerRef} className="space-y-2.5">
        {findings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            isSelected={finding.id === selectedFindingId}
            reviewState={stateOf(reviewStates, finding.id)}
            onClick={() => onSelectFinding?.(finding.id)}
            onSetReviewState={onSetReviewState}
          />
        ))}
      </div>

      <p className="text-[11px] text-slate-400 text-center pt-1">
        <kbd className="font-sans">j</kbd> / <kbd className="font-sans">k</kbd>{' '}
        navigate · <kbd className="font-sans">a</kbd> accept ·{' '}
        <kbd className="font-sans">r</kbd> reject
      </p>
    </>
  );
}
