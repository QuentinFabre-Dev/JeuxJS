import { useState } from 'react';
import { Loader2, ScanText, X } from 'lucide-react';

import { OCR_LANGUAGES } from '../services/ocr.js';

/**
 * Offer to run OCR on a PDF that carries no extractable text.
 *
 * Deliberately opt-in: recognition takes tens of seconds per page and makes the
 * machine work hard, so it is proposed rather than triggered.
 */
export default function OcrPrompt({
  pageCount,
  totalPages,
  language,
  onLanguageChange,
  onRun,
  onCancel,
  progress,
  isRunning,
}) {
  const [expanded, setExpanded] = useState(false);
  const wholeDocument = pageCount === totalPages;

  if (isRunning) {
    const ratio = progress?.total ? progress.done / progress.total : 0;
    return (
      <div className="rounded-xl bg-brand-50 ring-1 ring-brand-200 px-4 py-3.5 text-xs text-brand-900">
        <div className="flex items-center gap-2 font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          Reading the pages…
          <span className="ml-auto tabular-nums font-normal">
            {progress?.done ?? 0}/{progress?.total ?? pageCount}
            {progress?.page ? ` · page ${progress.page}` : ''}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="text-brand-700 hover:underline font-medium"
          >
            Stop
          </button>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3.5 text-xs text-amber-900">
      <div className="flex items-start gap-2">
        <ScanText className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">
            {wholeDocument
              ? 'This PDF looks scanned — no text could be extracted.'
              : `${pageCount} page${pageCount > 1 ? 's' : ''} of this PDF contain${pageCount > 1 ? '' : 's'} no text.`}
          </p>
          <p className="mt-1 opacity-80">
            Text recognition can read {wholeDocument ? 'it' : 'them'} locally.
            Count roughly 20 to 40 seconds per page.
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <select
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs
                         font-medium text-amber-900 focus:outline-none focus:ring-2
                         focus:ring-amber-400"
              aria-label="Recognition language"
            >
              {OCR_LANGUAGES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onRun}
              className="btn-primary !bg-amber-600 hover:!bg-amber-700 !px-3 !py-1.5 !text-xs"
            >
              <ScanText className="h-3.5 w-3.5" />
              Run text recognition
            </button>

            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-amber-800 hover:underline"
            >
              {expanded ? 'Hide details' : 'What does it change?'}
            </button>
          </div>

          {expanded && (
            <p className="mt-2 opacity-80 leading-relaxed">
              Recognition transcribes the page as it is, typos included — that is
              the point, since those are what the review looks for. It can also
              misread characters: findings coming from a recognised page are
              flagged, and given a slightly lower confidence.
            </p>
          )}
        </div>

        {!wholeDocument && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost !px-1.5 !py-1"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
