/**
 * Optical character recognition for scanned PDFs.
 *
 * Everything is served from `public/tesseract/`: engine, WASM core and language
 * data. Tesseract.js otherwise fetches them from a CDN at runtime, which would
 * send a request out of the machine and break the app offline.
 *
 * Word bounding boxes are kept, so a finding on an OCR'd page is highlighted at
 * its place on the page exactly like one from a text PDF.
 */

import { joinPdfLines, normaliseWithMap, textToBlocks } from './textBlocks.js';

// Served from `public/`, never from a CDN: the app has to work offline and a
// reviewed document must not leak a request to a third party.
const PDF_WORKER_SRC = '/pdfjs/pdf.worker.min.mjs';

const BASE = '/tesseract';
// Rendering above the screen resolution is what makes small print readable.
const RENDER_SCALE = 2.5;
// A page holding less than this many characters is treated as image-only.
export const TEXT_THRESHOLD = 40;

export const OCR_LANGUAGES = [
  { id: 'eng', label: 'English' },
  { id: 'fra', label: 'French' },
  { id: 'eng+fra', label: 'English + French' },
];

/** Maps the document language to the OCR language data available locally. */
export const ocrLanguageFor = (language) =>
  ({ fr: 'fra', en: 'eng' })[language] ?? 'eng';

/** SIMD has been available in every major browser since 2021; keep a fallback. */
const detectSimd = () => {
  try {
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10,
        10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ])
    );
  } catch {
    return false;
  }
};

/** Pages that came out of extraction with (almost) no text. */
export const pagesNeedingOcr = (documentModel) =>
  documentModel.pages
    .map((blocks, index) => ({
      page: index + 1,
      chars: blocks.reduce((total, block) => total + block.text.length, 0),
    }))
    .filter((entry) => entry.chars < TEXT_THRESHOLD)
    .map((entry) => entry.page);

/**
 * Groups OCR words into text lines, then into a page text with the rectangles
 * needed to highlight a sentence.
 */
export const buildPageFromWords = (words, scale) => {
  const lines = [];

  for (const word of words) {
    const box = word.bbox;
    const rect = {
      left: box.x0 / scale,
      top: box.y0 / scale,
      width: (box.x1 - box.x0) / scale,
      height: (box.y1 - box.y0) / scale,
    };

    const line = lines.find(
      (candidate) => Math.abs(candidate.top - rect.top) < rect.height * 0.6
    );
    if (line) {
      line.words.push({ text: word.text, rect });
      line.top = Math.min(line.top, rect.top);
    } else {
      lines.push({ top: rect.top, words: [{ text: word.text, rect }] });
    }
  }

  lines.sort((a, b) => a.top - b.top);
  for (const line of lines) line.words.sort((a, b) => a.rect.left - b.rect.left);

  let text = '';
  const spans = [];
  lines.forEach((line, index) => {
    line.words.forEach((word, position) => {
      if (position > 0) text += ' ';
      spans.push({
        start: text.length,
        end: text.length + word.text.length,
        rect: word.rect,
      });
      text += word.text;
    });
    if (index < lines.length - 1) text += '\n';
  });

  return { text, spans };
};

/** Attaches to each sentence the rectangles of the words it is made of. */
const attachRects = (blocks, pageText, spans) => {
  // The blocks come from a re-paragraphed copy of the page, so positions are
  // resolved through the index map rather than by raw offsets.
  const { normalised, map } = normaliseWithMap(pageText);
  const haystack = normalised.toLowerCase();
  let cursor = 0;

  for (const block of blocks) {
    const needle = block.text.toLowerCase();
    let at = haystack.indexOf(needle, cursor);
    if (at === -1) at = haystack.indexOf(needle);
    if (at === -1) continue;
    cursor = at + needle.length;

    const start = map[at];
    const end = map[Math.min(at + needle.length - 1, map.length - 1)];
    const covered = spans.filter((span) => span.end > start && span.start <= end);
    if (!covered.length) continue;

    // One rectangle per line of the sentence.
    const merged = [];
    for (const span of covered) {
      const line = merged.find(
        (candidate) => Math.abs(candidate.top - span.rect.top) < span.rect.height * 0.6
      );
      if (line) {
        const right = Math.max(line.left + line.width, span.rect.left + span.rect.width);
        line.left = Math.min(line.left, span.rect.left);
        line.top = Math.min(line.top, span.rect.top);
        line.height = Math.max(line.height, span.rect.height);
        line.width = right - line.left;
      } else {
        merged.push({ ...span.rect });
      }
    }
    block.rects = merged;
    block.fromOcr = true;
  }
  return blocks;
};

/**
 * Runs OCR over the given pages of a PDF and returns their blocks.
 *
 * @returns {Promise<Map<number, Array>>} page number → blocks
 */
export const runOcr = async ({
  pdfData,
  pages,
  language = 'eng',
  signal,
  onProgress,
}) => {
  const [{ createWorker }, pdfjs] = await Promise.all([
    import('tesseract.js'),
    import('pdfjs-dist'),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const corePath = detectSimd()
    ? `${BASE}/tesseract-core-simd-lstm.wasm.js`
    : `${BASE}/tesseract-core-lstm.wasm.js`;

  const worker = await createWorker(language, 1, {
    workerPath: `${BASE}/worker.min.js`,
    langPath: `${BASE}/lang`,
    corePath,
    // Never fall back to the CDN: the data is here or the feature fails loudly.
    cacheMethod: 'none',
  });

  const pdf = await pdfjs.getDocument({ data: pdfData.slice(0) }).promise;
  const results = new Map();

  try {
    for (const [index, pageNumber] of pages.entries()) {
      if (signal?.aborted) break;
      onProgress?.({ page: pageNumber, done: index, total: pages.length });

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvasContext: canvas.getContext('2d'), viewport })
        .promise;

      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const words = (data.blocks ?? []).flatMap((block) =>
        (block.paragraphs ?? []).flatMap((paragraph) =>
          (paragraph.lines ?? []).flatMap((line) => line.words ?? [])
        )
      );

      const { text, spans } = buildPageFromWords(
        words.filter((word) => word.text?.trim()),
        RENDER_SCALE
      );
      // Same treatment as a text PDF: without it a heading glues itself to the
      // sentence below and both are reported as one.
      results.set(
        pageNumber,
        attachRects(textToBlocks(joinPdfLines(text)), text, spans)
      );

      // Free the canvas before the next page.
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }

  onProgress?.({ page: null, done: pages.length, total: pages.length });
  return results;
};
