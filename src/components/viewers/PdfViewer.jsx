import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import HighlightLayer from './HighlightLayer.jsx';

// Served from `public/`, never from a CDN: the app has to work offline and a
// reviewed document must not leak a request to a third party.
const PDF_WORKER_SRC = '/pdfjs/pdf.worker.min.mjs';

/**
 * Renders the real PDF pages and overlays the findings on top of them.
 *
 * Pages are drawn only when they come close to the viewport and the canvases of
 * distant pages are released: a 60-page deck rendered eagerly would eat several
 * hundred megabytes for nothing.
 */
const RENDER_MARGIN = '600px';

function PdfPage({ pdf, pageNumber, scale, findings, ...highlightProps }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: element.closest('[data-viewer-scroll]'), rootMargin: RENDER_MARGIN }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!visible || !pdf) return;
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Draw at device resolution, lay out in CSS pixels.
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setSize({ width: viewport.width, height: viewport.height });

      renderTaskRef.current?.cancel();
      const task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      renderTaskRef.current = task;

      try {
        await task.promise;
      } catch (error) {
        // Cancelling a render throws; that is the normal path when scrolling.
        if (error?.name !== 'RenderingCancelledException') throw error;
      }
    };

    render();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [visible, pdf, pageNumber, scale]);

  return (
    <div
      ref={containerRef}
      data-page-number={pageNumber}
      className="relative mx-auto mb-6 bg-white shadow-card ring-1 ring-slate-200 scroll-mt-4"
      style={size ? { width: size.width, height: size.height } : { minHeight: 400 }}
    >
      <canvas ref={canvasRef} className="block" />

      {!size && (
        <div className="absolute inset-0 grid place-items-center text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {size && (
        <HighlightLayer findings={findings} scale={scale} {...highlightProps} />
      )}

      <span className="absolute -bottom-5 right-0 text-[10px] text-slate-400 tabular-nums">
        {pageNumber}
      </span>
    </div>
  );
}

export default function PdfViewer({
  source,
  findings,
  selectedFindingId,
  onSelectFinding,
  reviewStates,
  zoom,
  onPageCount,
}) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(null);
  const [fitScale, setFitScale] = useState(1);
  const scrollRef = useRef(null);

  // The document is opened once for the whole viewer lifetime.
  useEffect(() => {
    let cancelled = false;
    let opened = null;

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        // A copy per open: pdf.js detaches the buffer it receives.
        opened = await pdfjs.getDocument({ data: source.data.slice(0) }).promise;
        if (cancelled) {
          opened.destroy();
          return;
        }
        setPdf(opened);
        onPageCount?.(opened.numPages);
      } catch (cause) {
        if (!cancelled) setError(cause.message);
      }
    })();

    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [source, onPageCount]);

  // Fit the page width to the panel, and follow its resizing.
  const measure = useCallback(() => {
    const element = scrollRef.current;
    const pageWidth = source.geometry?.[0]?.width;
    if (!element || !pageWidth) return;
    const available = element.clientWidth - 32;
    setFitScale(Math.max(0.2, available / pageWidth));
  }, [source]);

  useEffect(() => {
    measure();
    const element = scrollRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  // Bring the page of the selected finding into view.
  useEffect(() => {
    if (!selectedFindingId || !scrollRef.current) return;
    const target = scrollRef.current.querySelector(
      `[data-finding-id="${selectedFindingId}"]`
    );
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Not rendered yet: scroll to its page and let the highlight follow.
    const finding = findings.find((item) => item.id === selectedFindingId);
    const page = finding && scrollRef.current.querySelector(
      `[data-page-number="${finding.page}"]`
    );
    page?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedFindingId, findings]);

  if (error) {
    return (
      <div className="flex-1 grid place-items-center p-6 text-center text-sm text-slate-500">
        This PDF could not be displayed. {error}
      </div>
    );
  }

  const scale = fitScale * zoom;
  const pageCount = pdf?.numPages ?? source.geometry?.length ?? 0;

  return (
    <div
      ref={scrollRef}
      data-viewer-scroll
      className="flex-1 overflow-auto bg-slate-100 px-4 py-4"
    >
      {Array.from({ length: pageCount }, (_, index) => (
        <PdfPage
          key={index + 1}
          pdf={pdf}
          pageNumber={index + 1}
          scale={scale}
          findings={findings.filter((finding) => finding.page === index + 1)}
          selectedFindingId={selectedFindingId}
          onSelectFinding={onSelectFinding}
          reviewStates={reviewStates}
        />
      ))}
    </div>
  );
}
