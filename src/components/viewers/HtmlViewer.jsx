import { useEffect, useMemo, useRef } from 'react';

import { REVIEW_STATES, stateOf } from '../../data/review.js';

/**
 * Renders a DOCX converted to HTML, with the findings highlighted in place.
 *
 * Word has no fixed pagination — page breaks are computed at print time — so
 * this viewer shows a continuous document, and the "page" numbers of the
 * findings stay what they are elsewhere in the app: analysis batches.
 *
 * Highlighting walks the text nodes rather than doing string surgery on the
 * HTML: a sentence routinely spans several inline elements, and replacing text
 * in the markup would break the formatting mammoth just produced.
 */

const ALLOWED = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'STRONG', 'EM',
  'B', 'I', 'U', 'BR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'A', 'IMG',
  'BLOCKQUOTE', 'SUP', 'SUB', 'SPAN', 'DIV', 'PRE', 'CODE', 'HR',
]);

/** Keeps mammoth's output but drops anything unexpected in it. */
const sanitise = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const doomed = [];

  while (walker.nextNode()) {
    const element = walker.currentNode;
    if (!ALLOWED.has(element.tagName)) {
      doomed.push(element);
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const isSafeLink = element.tagName === 'A' && name === 'href';
      const isImage = element.tagName === 'IMG' && (name === 'src' || name === 'alt');
      if (!isSafeLink && !isImage) element.removeAttribute(attribute.name);
      if (name === 'href' && /^javascript:/i.test(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  // Unwrap rather than delete: the text of an unknown element is still content.
  for (const element of doomed) element.replaceWith(...element.childNodes);
  return template.innerHTML;
};

const classesFor = (state, isSelected) => {
  if (isSelected) return 'bg-amber-300/70 ring-2 ring-amber-500 rounded-[3px]';
  if (state === REVIEW_STATES.ACCEPTED)
    return 'bg-emerald-200/50 ring-1 ring-emerald-400/60 rounded-[3px]';
  if (state === REVIEW_STATES.REJECTED)
    return 'bg-slate-200/60 ring-1 ring-slate-300 rounded-[3px] line-through';
  return 'bg-amber-200/50 ring-1 ring-amber-400/50 rounded-[3px] hover:bg-amber-200/80';
};

export default function HtmlViewer({
  source,
  findings,
  selectedFindingId,
  onSelectFinding,
  reviewStates,
  zoom,
}) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const html = useMemo(() => sanitise(source.html ?? ''), [source]);

  // Wrap the sentences that carry a finding, once the markup is in the DOM.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    // Start from a clean slate: previous marks are unwrapped.
    for (const mark of [...root.querySelectorAll('mark[data-finding-id]')]) {
      const parent = mark.parentNode;
      mark.replaceWith(document.createTextNode(mark.textContent));
      parent.normalize();
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    while (walker.nextNode()) {
      const node = walker.currentNode;
      nodes.push({ node, start: text.length, end: text.length + node.length });
      text += node.textContent;
    }
    const haystack = text.toLowerCase();

    for (const finding of findings) {
      const at = haystack.indexOf(finding.original.toLowerCase());
      if (at === -1) continue;
      const end = at + finding.original.length;

      const startNode = nodes.find((entry) => entry.start <= at && entry.end > at);
      const endNode = nodes.find((entry) => entry.start < end && entry.end >= end);
      if (!startNode || !endNode) continue;

      const range = document.createRange();
      range.setStart(startNode.node, at - startNode.start);
      range.setEnd(endNode.node, end - endNode.start);

      const mark = document.createElement('mark');
      mark.dataset.findingId = finding.id;
      mark.className = `${classesFor(
        reviewStates ? stateOf(reviewStates, finding.id) : REVIEW_STATES.PENDING,
        finding.id === selectedFindingId
      )} cursor-pointer px-0.5 text-inherit`;
      mark.title = finding.explanation ?? '';

      try {
        // Fails when the range crosses element boundaries unevenly; those
        // sentences simply stay unhighlighted rather than corrupting the DOM.
        range.surroundContents(mark);
      } catch {
        continue;
      }
    }
  }, [html, findings, selectedFindingId, reviewStates]);

  // Clicking a highlight selects the matching finding.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return undefined;
    const onClick = (event) => {
      const mark = event.target.closest('mark[data-finding-id]');
      if (mark) onSelectFinding?.(mark.dataset.findingId);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [onSelectFinding]);

  useEffect(() => {
    if (!selectedFindingId || !contentRef.current) return;
    contentRef.current
      .querySelector(`mark[data-finding-id="${selectedFindingId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedFindingId, findings]);

  return (
    <div
      ref={scrollRef}
      data-viewer-scroll
      className="flex-1 overflow-auto bg-slate-100 px-4 py-4"
    >
      <div
        className="mx-auto bg-white shadow-card ring-1 ring-slate-200 px-12 py-14"
        style={{ maxWidth: 820 * zoom, fontSize: `${zoom}rem` }}
      >
        <div
          ref={contentRef}
          className="docx-body text-[0.95em] leading-relaxed text-slate-800"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
