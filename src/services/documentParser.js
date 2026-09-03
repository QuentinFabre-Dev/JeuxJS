/**
 * Turns an uploaded file (PDF / DOCX / PPTX / TXT / MD) into the document model
 * used by the app:
 *
 *   {
 *     kind: 'pdf' | 'docx' | 'pptx' | 'text',
 *     title, subtitle, charCount,
 *     pages: [ [ { kind: 'heading' | 'p', text, rects? } ] ],
 *     source: { … }   // payload the viewer needs to render the real document
 *   }
 *
 * Sentences are split into individual blocks so that a finding can point at an
 * exact sentence. For PDF, each sentence also carries the rectangles it occupies
 * on the page, which is what lets the viewer highlight it in place.
 */

import { parsePptx } from './pptxParser.js';
import {
  joinPdfLines,
  normaliseWithMap,
  splitSentences,
  textToBlocks,
} from './textBlocks.js';

// Served from `public/`, never from a CDN: the app has to work offline and a
// reviewed document must not leak a request to a third party.
const PDF_WORKER_SRC = '/pdfjs/pdf.worker.min.mjs';

export { joinPdfLines, splitSentences, textToBlocks };

const MAX_BYTES = 20 * 1024 * 1024;
// Above this, a "page" is cut so the model never receives a huge single block.
const MAX_CHARS_PER_PAGE = 3500;

export class DocumentParseError extends Error {
  constructor(message, { hint } = {}) {
    super(message);
    this.name = 'DocumentParseError';
    this.hint = hint;
  }
}

const extensionOf = (name) => name.slice(name.lastIndexOf('.')).toLowerCase();

/** Groups blocks into pages of bounded size. */
const paginate = (blocks) => {
  const pages = [];
  let current = [];
  let size = 0;

  for (const block of blocks) {
    if (size + block.text.length > MAX_CHARS_PER_PAGE && current.length) {
      pages.push(current);
      current = [];
      size = 0;
    }
    current.push(block);
    size += block.text.length;
  }
  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
};

// ── Position anchoring ─────────────────────────────────────────────────────

/** Merges the rectangles of a same text line into one rectangle per line. */
const mergeRects = (rects) => {
  const lines = [];
  for (const rect of rects) {
    const line = lines.find(
      (candidate) => Math.abs(candidate.top - rect.top) < rect.height * 0.6
    );
    if (line) {
      const right = Math.max(line.left + line.width, rect.left + rect.width);
      line.left = Math.min(line.left, rect.left);
      line.top = Math.min(line.top, rect.top);
      line.height = Math.max(line.height, rect.height);
      line.width = right - line.left;
    } else {
      lines.push({ ...rect });
    }
  }
  return lines;
};

/**
 * Attaches to every sentence of a page the rectangles it occupies.
 * `spans` describes where each text fragment sits in the page text.
 */
const attachRects = (blocks, pageText, spans) => {
  const { normalised, map } = normaliseWithMap(pageText);
  const haystack = normalised.toLowerCase();
  let cursor = 0;

  for (const block of blocks) {
    const needle = block.text.toLowerCase();
    let at = haystack.indexOf(needle, cursor);
    // The sentence should come after the previous one; fall back to a global
    // search when a repeated sentence throws the cursor off.
    if (at === -1) at = haystack.indexOf(needle);
    if (at === -1) continue;

    cursor = at + needle.length;
    const start = map[at];
    const end = map[Math.min(at + needle.length - 1, map.length - 1)];

    const rects = spans
      .filter((span) => span.end > start && span.start <= end)
      .map((span) => span.rect);

    if (rects.length) block.rects = mergeRects(rects);
  }
  return blocks;
};

// ── Format-specific readers ────────────────────────────────────────────────

const parseTxt = async (file) => textToBlocks(await file.text());

const parseDocx = async (file) => {
  const mammoth = await import('mammoth/mammoth.browser.js');
  const buffer = await file.arrayBuffer();

  // Two passes on purpose: the HTML feeds the viewer, the raw text feeds the
  // sentence splitting (HTML tags would pollute it).
  const [{ value: html }, { value: text }] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer: buffer }),
    mammoth.extractRawText({ arrayBuffer: buffer }),
  ]);

  return { blocks: textToBlocks(text), html, bytes: buffer };
};

/**
 * PDF: one document page = one preview page, so the page numbers shown in the
 * findings match the real document. Text item positions are kept: they are what
 * the viewer overlays on the rendered page.
 */
const parsePdf = async (file) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const data = await file.arrayBuffer();
  // pdf.js takes ownership of the buffer it is given, so the viewer gets a copy.
  const viewerData = data.slice(0);

  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  const geometry = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    let pageText = '';
    const spans = [];

    for (const item of content.items) {
      const str = item.str ?? '';
      if (str) {
        // Position of the fragment in the page, top-left origin, scale 1.
        const tx = pdfjs.Util.transform(viewport.transform, item.transform);
        const height = Math.hypot(tx[2], tx[3]) || item.height || 0;
        spans.push({
          start: pageText.length,
          end: pageText.length + str.length,
          rect: {
            left: tx[4],
            top: tx[5] - height,
            width: item.width || 0,
            height,
          },
        });
      }
      pageText += str + (item.hasEOL ? '\n' : '');
    }

    const cleaned = joinPdfLines(pageText);

    const blocks = textToBlocks(cleaned);
    pages.push(attachRects(blocks, pageText, spans));
    geometry.push({ width: viewport.width, height: viewport.height });
  }

  await pdf.destroy();
  return { pages, source: { data: viewerData, geometry } };
};

// ── Entry point ────────────────────────────────────────────────────────────

export const parseDocument = async (file) => {
  if (!file) throw new DocumentParseError('No file provided.');
  if (file.size > MAX_BYTES) {
    throw new DocumentParseError('File is larger than 20 MB.', {
      hint: 'Split the document or export a lighter version.',
    });
  }

  const ext = extensionOf(file.name);
  let pages;
  let kind = 'text';
  let source = null;

  try {
    if (ext === '.pdf') {
      const result = await parsePdf(file);
      pages = result.pages;
      source = result.source;
      kind = 'pdf';
    } else if (ext === '.docx') {
      const { blocks, html, bytes } = await parseDocx(file);
      pages = paginate(blocks);
      // The bytes are kept, not just the HTML: regenerating a corrected
      // document means editing the original archive in place, and mammoth's
      // HTML is a one-way, deliberately impoverished view of it.
      source = { html, bytes };
      kind = 'docx';
    } else if (ext === '.pptx') {
      const result = await parsePptx(file);
      pages = result.pages;
      source = result.source;
      kind = 'pptx';
    } else if (ext === '.txt' || ext === '.md') {
      pages = paginate(await parseTxt(file));
      kind = 'text';
    } else if (ext === '.doc' || ext === '.ppt') {
      throw new DocumentParseError(`Legacy ${ext} files are not supported.`, {
        hint: `Save the file as ${ext === '.doc' ? '.docx' : '.pptx'} or .pdf and upload it again.`,
      });
    } else {
      throw new DocumentParseError(`Unsupported file type: ${ext}`, {
        hint: 'Supported formats: PDF, DOCX, PPTX, TXT, MD.',
      });
    }
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError(`Could not read ${file.name}.`, {
      hint: error.message,
    });
  }

  // For PDF and PPTX a page index is a real page/slide number: dropping empty
  // pages would shift every following number and send the viewer to the wrong
  // page. Synthetic pagination (DOCX, text) has no such constraint.
  const keepsNumbering = kind === 'pdf' || kind === 'pptx';
  const finalPages = keepsNumbering ? pages : pages.filter((page) => page.length > 0);

  // A PDF without text is not a failure: it is a scan, and the app offers to
  // run recognition on it. Any other empty file is a dead end.
  if (!finalPages.some((page) => page.length > 0) && kind !== 'pdf') {
    throw new DocumentParseError('No text could be extracted from this file.', {
      hint: 'The file seems to contain no readable text.',
    });
  }

  const firstText =
    finalPages.flat().find((block) => block.text)?.text ?? file.name;

  return {
    kind,
    source,
    title: file.name,
    subtitle: firstText.length > 90 ? `${firstText.slice(0, 90)}…` : firstText,
    pages: finalPages,
    charCount: finalPages
      .flat()
      .reduce((total, block) => total + block.text.length, 0),
  };
};
