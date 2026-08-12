/**
 * Turns an uploaded file (PDF / DOCX / TXT / MD) into the document model used
 * by the app:
 *
 *   { title, subtitle, pages: [ [ { kind: 'heading' | 'p', text } ] ] }
 *
 * Sentences are split into individual blocks so that a finding can point at an
 * exact sentence, which is what <DocumentPreview /> highlights.
 */

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

/** Splits a paragraph into sentences, keeping their punctuation. */
export const splitSentences = (paragraph) =>
  paragraph
    .replace(/\s+/g, ' ')
    .trim()
    // Split after . ! ? … followed by a space and an uppercase-ish start.
    .split(/(?<=[.!?…])\s+(?=[«"'(\[]?[A-ZÀ-ÝŒ0-9])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const looksLikeHeading = (text) =>
  text.length <= 90 &&
  !/[.!?]$/.test(text) &&
  (/^\d+(\.\d+)*[.)]?\s+\S/.test(text) || text === text.toUpperCase());

/** Converts raw text into typed blocks (headings + one block per sentence). */
export const textToBlocks = (raw) => {
  const blocks = [];
  for (const paragraph of raw.split(/\n\s*\n+/)) {
    const clean = paragraph.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (looksLikeHeading(clean)) {
      blocks.push({ kind: 'heading', text: clean });
      continue;
    }
    for (const sentence of splitSentences(clean)) {
      blocks.push({ kind: 'p', text: sentence });
    }
  }
  return blocks;
};

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

const parseTxt = async (file) => textToBlocks(await file.text());

const parseDocx = async (file) => {
  const mammoth = await import('mammoth/mammoth.browser.js');
  const { value } = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  return textToBlocks(value);
};

/**
 * PDF: one document page = one preview page, so the page numbers shown in the
 * findings match the real document.
 */
const parsePdf = async (file) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    // pdf.js returns text items; `hasEOL` marks the end of a visual line.
    const text = content.items
      .map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ''))
      .join('')
      // A line break inside a sentence is a space; a blank line is a paragraph.
      .replace(/-\n/g, '')
      .replace(/\n{2,}/g, '\n\n')
      .replace(/(?<!\n)\n(?!\n)/g, ' ');

    pages.push(textToBlocks(text));
  }

  return pages;
};

export const parseDocument = async (file) => {
  if (!file) throw new DocumentParseError('No file provided.');
  if (file.size > MAX_BYTES) {
    throw new DocumentParseError('File is larger than 20 MB.', {
      hint: 'Split the document or export a lighter version.',
    });
  }

  const ext = extensionOf(file.name);
  let pages;

  try {
    if (ext === '.pdf') {
      pages = await parsePdf(file);
    } else if (ext === '.docx') {
      pages = paginate(await parseDocx(file));
    } else if (ext === '.txt' || ext === '.md') {
      pages = paginate(await parseTxt(file));
    } else if (ext === '.doc') {
      throw new DocumentParseError('Legacy .doc files are not supported.', {
        hint: 'Save the file as .docx or .pdf and upload it again.',
      });
    } else {
      throw new DocumentParseError(`Unsupported file type: ${ext}`, {
        hint: 'Supported formats: PDF, DOCX, TXT, MD.',
      });
    }
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError(`Could not read ${file.name}.`, {
      hint: error.message,
    });
  }

  const nonEmpty = pages.filter((page) => page.length > 0);
  if (!nonEmpty.length) {
    throw new DocumentParseError('No text could be extracted from this file.', {
      hint: 'Scanned PDFs need OCR before they can be analysed.',
    });
  }

  const firstText = nonEmpty[0].find((block) => block.text)?.text ?? file.name;

  return {
    title: file.name,
    subtitle:
      firstText.length > 90 ? `${firstText.slice(0, 90)}…` : firstText,
    pages: nonEmpty,
    charCount: nonEmpty
      .flat()
      .reduce((total, block) => total + block.text.length, 0),
  };
};
