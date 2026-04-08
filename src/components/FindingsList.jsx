import { Inbox } from 'lucide-react';
import FindingCard from './FindingCard.jsx';

export default function FindingsList({ findings, isAnalyzing }) {
  if (findings.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 grid place-items-center mb-3">
          <Inbox className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          {isAnalyzing ? 'En attente des premiers résultats…' : 'Aucun finding à afficher'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {isAnalyzing
            ? 'Les anomalies apparaîtront ici dès qu\u2019elles sont détectées.'
            : 'Ajustez vos filtres pour voir plus de résultats.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((finding) => (
        <FindingCard key={finding.id} finding={finding} />
      ))}
    </div>
  );
}
