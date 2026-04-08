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

  // Auto-scroll vers la card sélectionnée (utile quand la sélection
  // vient du document plutôt que de la liste).
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
            ? 'En attente des premiers résultats…'
            : 'Aucun finding à afficher'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {isAnalyzing
            ? "Les anomalies apparaîtront ici dès qu\u2019elles sont détectées."
            : 'Ajustez vos filtres pour voir plus de résultats.'}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-3">
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
