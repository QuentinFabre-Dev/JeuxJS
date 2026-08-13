import { BadgeCheck, RotateCcw } from 'lucide-react';

/**
 * Shown when the analysis completed without a single finding.
 * This is a good outcome and must not look like the amber error banner.
 */
export default function CleanDocumentState({
  fileName,
  skillCount,
  customCheckCount,
  onRerun,
}) {
  return (
    <div className="card p-10 text-center border-emerald-200/70 bg-emerald-50/30">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-100 grid place-items-center mb-4">
        <BadgeCheck className="h-7 w-7 text-emerald-600" />
      </div>
      <p className="text-base font-semibold text-slate-900">
        No issue found in this document
      </p>
      <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
        {fileName ? <span className="font-medium">{fileName}</span> : 'The document'}{' '}
        passed all {skillCount} check{skillCount > 1 ? 's' : ''}
        {customCheckCount > 0
          ? ` and ${customCheckCount} custom check${customCheckCount > 1 ? 's' : ''}`
          : ''}
        .
      </p>
      <p className="text-xs text-slate-500 mt-4 max-w-md mx-auto">
        A clean result can also mean the model was too lenient: a larger model or
        stricter custom checks will dig deeper.
      </p>
      {onRerun && (
        <button type="button" onClick={onRerun} className="btn-ghost mt-4 mx-auto">
          <RotateCcw className="h-4 w-4" />
          Run again
        </button>
      )}
    </div>
  );
}
