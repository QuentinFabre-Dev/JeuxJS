import { Cloud, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import useFocusTrap from '../hooks/useFocusTrap.js';

/**
 * Asked once per session before the first analysis on a cloud provider.
 *
 * Everything else in this app is built on "nothing leaves this machine";
 * switching to a hosted API breaks that promise, and breaking it silently would
 * be the wrong default — the user has to say yes.
 */
export default function CloudConfirmDialog({
  providerLabel,
  fileName,
  pageCount,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useFocusTrap(true, onCancel);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="card w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-confirm-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-100 grid place-items-center shrink-0">
              <Cloud className="h-4.5 w-4.5 text-orange-600" />
            </div>
            <div>
              <h2
                id="cloud-confirm-title"
                className="text-base font-semibold text-slate-900"
              >
                Send this document to {providerLabel}?
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                It will leave this machine.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost !px-2 !py-2"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3.5 py-3 text-xs text-slate-700 mb-4">
          <p>
            The text of{' '}
            <span className="font-medium text-slate-900">
              {fileName ?? 'this document'}
            </span>
            {pageCount ? ` (${pageCount} page${pageCount > 1 ? 's' : ''})` : ''} is
            sent to {providerLabel} for analysis.
          </p>
          <p className="mt-1.5 text-slate-500">
            Do not use a cloud provider for confidential deliverables — switch
            back to the local model for those.
          </p>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost flex-1 ring-1 ring-slate-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary flex-1 !bg-orange-600 hover:!bg-orange-700"
          >
            Send and analyse
          </button>
        </div>

        <p className="text-[11px] text-slate-400 mt-3 text-center">
          Asked once per session, for each new analysis run.
        </p>
      </div>
    </div>,
    document.body
  );
}
