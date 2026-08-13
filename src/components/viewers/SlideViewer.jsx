import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { REVIEW_STATES, stateOf } from '../../data/review.js';

/**
 * Renders PPTX slides from the geometry read in the file: every text box and
 * picture is placed where PowerPoint puts it, in a normalised coordinate space
 * that is simply scaled to the panel width.
 *
 * Text carrying a finding is highlighted in place, inside its own box.
 */

const highlightClasses = (state, isSelected) => {
  if (isSelected) return 'bg-amber-300/60 ring-2 ring-amber-500 rounded-[3px]';
  if (state === REVIEW_STATES.ACCEPTED)
    return 'bg-emerald-300/30 ring-1 ring-emerald-400/60 rounded-[3px]';
  if (state === REVIEW_STATES.REJECTED)
    return 'bg-slate-300/30 ring-1 ring-slate-300 rounded-[3px] line-through';
  return 'bg-amber-200/45 ring-1 ring-amber-400/50 rounded-[3px] hover:bg-amber-200/70';
};

/** Splits a paragraph so that the sentences carrying findings can be wrapped. */
const segmentsFor = (text, findings) => {
  const matches = [];
  for (const finding of findings) {
    const at = text.toLowerCase().indexOf(finding.original.toLowerCase());
    if (at !== -1) {
      matches.push({ start: at, end: at + finding.original.length, finding });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue; // overlapping findings: keep the first
    if (match.start > cursor) {
      segments.push({ text: text.slice(cursor, match.start) });
    }
    segments.push({ text: text.slice(match.start, match.end), finding: match.finding });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
};

function Paragraph({ paragraph, findings, selectedFindingId, onSelectFinding, reviewStates }) {
  const segments = segmentsFor(paragraph.text, findings);

  return (
    <p
      style={{
        // PowerPoint stores sizes in hundredths of a point; slides are laid out
        // in the same normalised space, so points map directly to units.
        fontSize: paragraph.size ? paragraph.size / 100 : undefined,
        fontWeight: paragraph.bold ? 700 : undefined,
        fontStyle: paragraph.italic ? 'italic' : undefined,
        textAlign: { ctr: 'center', r: 'right', just: 'justify' }[paragraph.align],
        marginLeft: paragraph.level ? paragraph.level * 16 : undefined,
      }}
      className="leading-snug"
    >
      {segments.map((segment, index) =>
        segment.finding ? (
          <button
            key={index}
            type="button"
            data-finding-id={segment.finding.id}
            onClick={() => onSelectFinding?.(segment.finding.id)}
            title={segment.finding.explanation}
            className={`${highlightClasses(
              reviewStates ? stateOf(reviewStates, segment.finding.id) : REVIEW_STATES.PENDING,
              segment.finding.id === selectedFindingId
            )} text-left px-0.5 transition-colors`}
          >
            {segment.text}
          </button>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </p>
  );
}

function Slide({ slide, width, height, findings, ...rest }) {
  return (
    <section
      data-page-number={slide.number}
      className="relative mx-auto mb-6 bg-white shadow-card ring-1 ring-slate-200 overflow-hidden scroll-mt-4"
      style={{ width, height }}
    >
      {slide.shapes.map((shape, index) => {
        // Fallback when neither the slide nor its layout carries geometry:
        // title on top, body below, so shapes never pile up on each other.
        const frame =
          shape.frame ??
          (shape.isTitle
            ? { left: width * 0.06, top: height * 0.07, width: width * 0.88, height: height * 0.2 }
            : { left: width * 0.06, top: height * 0.32, width: width * 0.88, height: height * 0.58 });
        const style = {
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: shape.kind === 'image' ? frame.height : undefined,
        };

        if (shape.kind === 'image') {
          return (
            <img
              key={index}
              src={shape.src}
              alt=""
              className="absolute object-contain"
              style={style}
            />
          );
        }

        return (
          <div
            key={index}
            className={`absolute ${
              shape.isTitle ? 'font-semibold text-slate-900' : 'text-slate-700'
            }`}
            style={{ ...style, fontSize: shape.isTitle ? 40 : 18 }}
          >
            {shape.paragraphs.map((paragraph, position) => (
              <Paragraph
                key={position}
                paragraph={paragraph}
                findings={findings}
                {...rest}
              />
            ))}
          </div>
        );
      })}

      <span className="absolute bottom-1 right-2 text-[10px] text-slate-300 tabular-nums">
        {slide.number}
      </span>
    </section>
  );
}

export default function SlideViewer({
  source,
  findings,
  selectedFindingId,
  onSelectFinding,
  reviewStates,
  zoom,
  onPageCount,
}) {
  const scrollRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    onPageCount?.(source.slides.length);
  }, [source, onPageCount]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const measure = () =>
      setFitScale(Math.max(0.2, (element.clientWidth - 32) / source.width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [source]);

  useEffect(() => {
    if (!selectedFindingId || !scrollRef.current) return;
    const target = scrollRef.current.querySelector(
      `[data-finding-id="${selectedFindingId}"]`
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedFindingId]);

  const scale = fitScale * zoom;

  return (
    <div
      ref={scrollRef}
      data-viewer-scroll
      className="flex-1 overflow-auto bg-slate-100 px-4 py-4"
    >
      {source.slides.map((slide) => (
        <div
          key={slide.number}
          style={{
            width: source.width * scale,
            height: source.height * scale,
            margin: '0 auto 1.5rem',
          }}
        >
          {/* The slide is laid out at its natural size and scaled as a whole,
              so text and boxes keep their exact relative positions. */}
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: source.width,
              height: source.height,
            }}
          >
            <Slide
              slide={slide}
              width={source.width}
              height={source.height}
              findings={findings.filter((finding) => finding.page === slide.number)}
              selectedFindingId={selectedFindingId}
              onSelectFinding={onSelectFinding}
              reviewStates={reviewStates}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
