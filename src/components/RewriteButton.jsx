'use client';

import { useState } from 'react';
import { AlertTriangle, Download, FileCheck2, Loader2 } from 'lucide-react';

import { REFUSAL, canRewrite, plannedEdits, rewriteDocument } from '../services/rewrite/index.js';
import { REVIEW_STATES, stateOf } from '../data/review.js';

/**
 * The corrected document, built from the accepted findings only.
 *
 * The count on the button is the promise the file has to keep, so it counts
 * what will actually be applied — a suggestion identical to its sentence, or
 * one conflicting with another accepted correction, is not in it.
 */
export default function RewriteButton({ file, documentModel, findings, states }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  if (!file || !documentModel) return null;

  const accepted = findings.filter(
    (finding) => stateOf(states, finding.id) === REVIEW_STATES.ACCEPTED
  );
  const { edits, conflicts } = plannedEdits(findings, states);
  const count = edits.reduce((total, edit) => total + edit.ids.length, 0);
  const pending = findings.filter(
    (finding) => stateOf(states, finding.id) === REVIEW_STATES.PENDING
  ).length;

  const supported = canRewrite(documentModel);

  const download = async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const result = await rewriteDocument({ file, documentModel, findings, states });

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);

      setReport({ ...result.report, filename: result.filename });
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <header className="flex items-center gap-2 mb-1">
        <FileCheck2 className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900">Corrected document</h3>
      </header>
      <p className="text-[11px] text-slate-400 mb-3">
        Your file, in its own format and layout, with the corrections you
        accepted — and nothing else.
      </p>

      <button
        type="button"
        onClick={download}
        disabled={busy || !count || !supported}
        className="btn-primary w-full !text-xs"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
        )}
        {count
          ? `Download with ${count} correction${count > 1 ? 's' : ''}`
          : 'Accept a finding first'}
      </button>

      {!supported && (
        <p className="mt-2 text-[11px] text-amber-700">
          {REFUSAL[documentModel.kind] ??
            `The ${documentModel.kind} format cannot be regenerated.`}
        </p>
      )}

      {/* Silence is not consent on a document going to a client. */}
      {supported && pending > 0 && count > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          {pending} finding{pending > 1 ? 's are' : ' is'} still open and will
          not be applied. Only what you accepted goes in.
        </p>
      )}

      {conflicts.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {conflicts.length} accepted correction{conflicts.length > 1 ? 's touch' : ' touches'}{' '}
          the same words as another and cannot be combined. Fix that sentence by
          hand.
        </p>
      )}

      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}

      {report && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] ring-1 ring-slate-200">
          <p className="font-medium text-slate-800">{report.filename}</p>
          <p className="mt-0.5 text-slate-500">
            {report.applied} correction{report.applied > 1 ? 's' : ''} applied
            across {report.sentences} sentence{report.sentences > 1 ? 's' : ''}.
          </p>
          {report.grown?.length > 0 && (
            <p className="mt-1.5 text-amber-700">
              PowerPoint does not reflow: the text grew on slide
              {report.grown.length > 1 ? 's' : ''} {report.grown.join(', ')}.
              Check {report.grown.length > 1 ? 'they' : 'it'} still fits.
            </p>
          )}
          {report.skipped?.length > 0 && (
            <p className="mt-1.5 text-amber-700">
              {report.skipped.length} correction
              {report.skipped.length > 1 ? 's span' : ' spans'} a paragraph
              break, which no text edit can express. Left out:{' '}
              {report.skipped.map((entry) => entry.sentenceId).join(', ')}.
            </p>
          )}
          {report.notFound?.length > 0 && (
            <p className="mt-1.5 text-amber-700">
              {report.notFound.length} could not be placed in the file and{' '}
              {report.notFound.length > 1 ? 'were' : 'was'} left out:{' '}
              {report.notFound.map((entry) => entry.sentenceId).join(', ')}. Fix{' '}
              {report.notFound.length > 1 ? 'those' : 'that one'} by hand.
            </p>
          )}
        </div>
      )}

      {accepted.length > 0 && count === 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          The accepted findings suggest the sentence exactly as it already is —
          nothing to change.
        </p>
      )}
    </section>
  );
}
