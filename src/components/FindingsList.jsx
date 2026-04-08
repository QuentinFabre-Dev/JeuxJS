import { useEffect, useRef } from 'react';
import { Inbox } from 'lucide-react';
import FindingCard from './FindingCard.jsx';

export default function FindingsList({
  findings,
  isAnalyzing,
  selectedFindingId,
  onSelectFinding,
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

  if (findings.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 grid place-items-center mb-3">
          <Inbox className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          {isAnalyzing
            ? 'Waiting for first results…'
            : 'No findings to display'}
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
    <div ref={containerRef} className="space-y-2.5">
      {findings.map((finding) => (
        <FindingCard
          key={finding.id}
          finding={finding}
          isSelected={finding.id === selectedFindingId}
          onClick={() => onSelectFinding?.(finding.id)}
        />
      ))}
    </div>
  );
}
