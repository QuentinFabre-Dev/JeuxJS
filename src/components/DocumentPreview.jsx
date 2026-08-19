import { useMemo, useState } from 'react';
import {
  FileText,
  Maximize2,
  Minimize2,
  Presentation,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { MOCK_DOCUMENT } from '../data/mockDocument.js';
import PdfViewer from './viewers/PdfViewer.jsx';
import HtmlViewer from './viewers/HtmlViewer.jsx';
import SlideViewer from './viewers/SlideViewer.jsx';
import TextViewer from './viewers/TextViewer.jsx';

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

const KIND_LABELS = {
  pdf: { label: 'PDF', unit: 'page', Icon: FileText },
  docx: { label: 'Word', unit: 'section', Icon: FileText },
  pptx: { label: 'PowerPoint', unit: 'slide', Icon: Presentation },
  text: { label: 'Text', unit: 'page', Icon: FileText },
};

/**
 * Shows the document as it really is and highlights the findings in place.
 *
 * Each format gets the most faithful rendering available: real pages for PDF,
 * converted layout for Word, positioned shapes for PowerPoint. Plain text has
 * no layout to reproduce, so its blocks are the document.
 */
export default function DocumentPreview({
  documentModel,
  findings,
  selectedFindingId,
  onSelectFinding,
  reviewStates,
  isExpanded,
  onToggleExpand,
}) {
  const [zoomIndex, setZoomIndex] = useState(3);
  const [pageCount, setPageCount] = useState(null);

  // Real uploaded document when available, mocked one in demo mode.
  const doc = documentModel ?? MOCK_DOCUMENT;
  // The mocked document declares its own kind, so demo mode labels itself
  // "Word" like the real file it stands for.
  const kind = documentModel?.kind ?? doc.kind ?? 'text';
  const { label, unit, Icon } = KIND_LABELS[kind] ?? KIND_LABELS.text;
  const zoom = ZOOM_STEPS[zoomIndex];

  const viewerProps = {
    findings,
    selectedFindingId,
    onSelectFinding,
    reviewStates,
    zoom,
    onPageCount: setPageCount,
  };

  const count = pageCount ?? doc.pages.length;

  const viewer = useMemo(() => {
    if (kind === 'pdf' && documentModel.source?.data) {
      return <PdfViewer source={documentModel.source} {...viewerProps} />;
    }
    if (kind === 'docx' && documentModel.source?.html) {
      return <HtmlViewer source={documentModel.source} {...viewerProps} />;
    }
    if (kind === 'pptx' && documentModel.source?.slides) {
      return <SlideViewer source={documentModel.source} {...viewerProps} />;
    }
    return <TextViewer documentModel={doc} {...viewerProps} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    kind,
    documentModel,
    doc,
    findings,
    selectedFindingId,
    onSelectFinding,
    reviewStates,
    zoom,
  ]);

  return (
    <div
      className={`card overflow-hidden flex flex-col ${
        isExpanded ? 'h-[calc(100vh-140px)]' : 'h-[calc(100vh-180px)] min-h-[480px]'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center shrink-0">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
          <p className="text-[11px] text-slate-500 -mt-0.5 truncate">
            {label} · {count} {unit}
            {count > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
            disabled={zoomIndex === 0}
            className="btn-ghost !px-1.5 !py-1.5 disabled:opacity-30"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex(3)}
            className="text-[11px] text-slate-500 tabular-nums w-11 hover:text-slate-800"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() =>
              setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))
            }
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            className="btn-ghost !px-1.5 !py-1.5 disabled:opacity-30"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="btn-ghost !px-1.5 !py-1.5"
              aria-label={isExpanded ? 'Collapse document' : 'Expand document'}
              title={isExpanded ? 'Back to split view' : 'Give the document more room'}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {viewer}

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 flex items-center gap-2 shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-brand-500" />
        {findings.length === 0
          ? 'Findings will be highlighted here, at their exact place in the document.'
          : `${findings.length} finding${findings.length > 1 ? 's' : ''} highlighted — click one to link it with the list.`}
      </div>
    </div>
  );
}
