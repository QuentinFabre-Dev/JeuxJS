/**
 * PPTX reader.
 *
 * A .pptx is a ZIP of XML parts. Slides live in `ppt/slides/slideN.xml`, where
 * each shape carries both its text and its position on the slide. Keeping that
 * geometry is what allows the viewer to show something that actually looks like
 * the deck instead of a list of bullet points.
 *
 * One slide = one page in the document model, so a finding reads "slide 4".
 */

import { textToBlocks } from './textBlocks.js';

// PowerPoint measures in EMU (English Metric Units).
// Slides are rendered in a normalised 960-unit-wide space; the viewer scales it.
const SLIDE_WIDTH = 960;

const xml = (text) => new DOMParser().parseFromString(text, 'application/xml');

/** `<a:t>` nodes hold the actual characters; everything else is formatting. */
const textOf = (node) =>
  [...node.getElementsByTagName('a:t')].map((t) => t.textContent).join('');

const attrNumber = (node, name) => {
  const value = node?.getAttribute?.(name);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Reads `<a:xfrm>` — offset and extent — of a shape, in EMU. */
const readFrame = (shape) => {
  const xfrm = shape.getElementsByTagName('a:xfrm')[0];
  const off = xfrm?.getElementsByTagName('a:off')[0];
  const ext = xfrm?.getElementsByTagName('a:ext')[0];
  if (!off || !ext) return null;

  return {
    x: attrNumber(off, 'x') ?? 0,
    y: attrNumber(off, 'y') ?? 0,
    width: attrNumber(ext, 'cx') ?? 0,
    height: attrNumber(ext, 'cy') ?? 0,
  };
};

/** Placeholder descriptor: `title` and `ctrTitle` are the slide titles. */
const placeholderOf = (shape) => {
  const ph = shape.getElementsByTagName('p:ph')[0];
  if (!ph) return null;
  return { type: ph.getAttribute('type'), idx: ph.getAttribute('idx') };
};

/**
 * Indexes the shapes of a layout (or master) by placeholder, so that a slide
 * shape without geometry of its own can inherit it.
 *
 * PowerPoint only writes an `<a:xfrm>` on a placeholder when the user moved or
 * resized it; a deck built from a template usually has none, and every shape
 * would otherwise pile up at the same spot.
 */
const indexPlaceholders = (document) => {
  const byIdx = new Map();
  const byType = new Map();

  for (const shape of document.getElementsByTagName('p:sp')) {
    const placeholder = placeholderOf(shape);
    const frame = readFrame(shape);
    if (!placeholder || !frame) continue;
    if (placeholder.idx !== null && !byIdx.has(placeholder.idx)) {
      byIdx.set(placeholder.idx, frame);
    }
    if (placeholder.type && !byType.has(placeholder.type)) {
      byType.set(placeholder.type, frame);
    }
  }
  return { byIdx, byType };
};

/** Follows a relationship of the given type from a part to its target. */
const followRelation = async (zip, partPath, type) => {
  const [directory, name] = [
    partPath.slice(0, partPath.lastIndexOf('/')),
    partPath.slice(partPath.lastIndexOf('/') + 1),
  ];
  const file = zip.file(`${directory}/_rels/${name}.rels`);
  if (!file) return null;

  const document = xml(await file.async('string'));
  for (const relation of document.getElementsByTagName('Relationship')) {
    if (relation.getAttribute('Type')?.endsWith(`/${type}`)) {
      const target = relation.getAttribute('Target') ?? '';
      return target.startsWith('/')
        ? target.slice(1)
        : `${directory}/${target}`.replace(/[^/]+\/\.\.\//g, '');
    }
  }
  return null;
};

/** Geometry inherited from the slide's layout, then from the master. */
const readInheritedFrames = async (zip, slidePath, cache) => {
  const layoutPath = await followRelation(zip, slidePath, 'slideLayout');
  if (!layoutPath || !zip.file(layoutPath)) return null;
  if (cache.has(layoutPath)) return cache.get(layoutPath);

  const layout = indexPlaceholders(xml(await zip.file(layoutPath).async('string')));

  const masterPath = await followRelation(zip, layoutPath, 'slideMaster');
  if (masterPath && zip.file(masterPath)) {
    const master = indexPlaceholders(
      xml(await zip.file(masterPath).async('string'))
    );
    for (const [key, value] of master.byIdx) {
      if (!layout.byIdx.has(key)) layout.byIdx.set(key, value);
    }
    for (const [key, value] of master.byType) {
      if (!layout.byType.has(key)) layout.byType.set(key, value);
    }
  }

  cache.set(layoutPath, layout);
  return layout;
};

const readParagraphs = (shape) => {
  const body = shape.getElementsByTagName('p:txBody')[0];
  if (!body) return [];

  return [...body.getElementsByTagName('a:p')]
    .map((paragraph) => {
      const runs = [...paragraph.getElementsByTagName('a:r')];
      const text = runs.map(textOf).join('').trim();
      if (!text) return null;

      const properties = runs[0]?.getElementsByTagName('a:rPr')[0];
      const alignment =
        paragraph.getElementsByTagName('a:pPr')[0]?.getAttribute('algn') ?? null;
      const indent = attrNumber(
        paragraph.getElementsByTagName('a:pPr')[0],
        'lvl'
      );

      return {
        text,
        // `sz` is in hundredths of a point.
        size: attrNumber(properties, 'sz'),
        bold: properties?.getAttribute('b') === '1',
        italic: properties?.getAttribute('i') === '1',
        align: alignment,
        level: indent ?? 0,
      };
    })
    .filter(Boolean);
};

/** Maps `r:embed` identifiers to the media files of the archive. */
const readRelations = async (zip, slideName) => {
  const relations = new Map();
  const file = zip.file(`ppt/slides/_rels/${slideName}.rels`);
  if (!file) return relations;

  const document = xml(await file.async('string'));
  for (const relation of document.getElementsByTagName('Relationship')) {
    relations.set(
      relation.getAttribute('Id'),
      relation.getAttribute('Target')?.replace('../', 'ppt/')
    );
  }
  return relations;
};

const MIME_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

/** Slide order comes from the presentation part, not from file names. */
const readSlideOrder = async (zip) => {
  const presentation = zip.file('ppt/presentation.xml');
  const relationsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presentation || !relationsFile) return null;

  const relations = new Map();
  const relationsXml = xml(await relationsFile.async('string'));
  for (const relation of relationsXml.getElementsByTagName('Relationship')) {
    relations.set(relation.getAttribute('Id'), relation.getAttribute('Target'));
  }

  const document = xml(await presentation.async('string'));
  const ids = [...document.getElementsByTagName('p:sldId')];
  const order = ids
    .map((node) => relations.get(node.getAttribute('r:id')))
    .filter(Boolean)
    .map((target) => target.replace(/^\/?(ppt\/)?/, '').replace(/^slides\//, ''));

  const size = document.getElementsByTagName('p:sldSz')[0];
  return {
    order,
    slideSize: {
      width: attrNumber(size, 'cx') ?? 12192000,
      height: attrNumber(size, 'cy') ?? 6858000,
    },
  };
};

export const parsePptx = async (file) => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const presentation = await readSlideOrder(zip);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(
      (a, b) =>
        Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1])
    );

  if (!slideFiles.length) {
    throw new Error('No slide found in this presentation.');
  }

  // Presentation order when available, file order otherwise.
  const ordered = presentation?.order?.length
    ? presentation.order
        .map((name) => `ppt/slides/${name}`)
        .filter((name) => zip.file(name))
    : slideFiles;

  const emuWidth = presentation?.slideSize.width ?? 12192000;
  const emuHeight = presentation?.slideSize.height ?? 6858000;
  const toUnits = (emu) => (emu / emuWidth) * SLIDE_WIDTH;
  const slideHeight = (emuHeight / emuWidth) * SLIDE_WIDTH;

  const pages = [];
  const slides = [];
  const layoutCache = new Map();

  for (const [index, name] of ordered.entries()) {
    const document = xml(await zip.file(name).async('string'));
    const relations = await readRelations(zip, name.split('/').pop());
    const inherited = await readInheritedFrames(zip, name, layoutCache);
    const shapes = [];

    for (const shape of document.getElementsByTagName('p:sp')) {
      const paragraphs = readParagraphs(shape);
      if (!paragraphs.length) continue;

      const placeholder = placeholderOf(shape);
      const isTitle =
        placeholder?.type === 'title' || placeholder?.type === 'ctrTitle';

      const frame =
        readFrame(shape) ??
        (placeholder && inherited
          ? (inherited.byIdx.get(placeholder.idx) ??
             inherited.byType.get(placeholder.type) ??
             (isTitle ? inherited.byType.get('title') : null))
          : null);

      shapes.push({
        kind: 'text',
        isTitle,
        paragraphs,
        placeholderType: placeholder?.type ?? null,
        frame: frame && {
          left: toUnits(frame.x),
          top: toUnits(frame.y),
          width: toUnits(frame.width),
          height: toUnits(frame.height),
        },
      });
    }

    for (const picture of document.getElementsByTagName('p:pic')) {
      const frame = readFrame(picture);
      const embed = picture
        .getElementsByTagName('a:blip')[0]
        ?.getAttribute('r:embed');
      const target = embed ? relations.get(embed) : null;
      const media = target ? zip.file(target) : null;
      if (!frame || !media) continue;

      const extension = target.split('.').pop().toLowerCase();
      const base64 = await media.async('base64');
      shapes.push({
        kind: 'image',
        src: `data:${MIME_BY_EXTENSION[extension] ?? 'image/png'};base64,${base64}`,
        frame: {
          left: toUnits(frame.x),
          top: toUnits(frame.y),
          width: toUnits(frame.width),
          height: toUnits(frame.height),
        },
      });
    }

    const titleShape = shapes.find((shape) => shape.isTitle);
    slides.push({
      number: index + 1,
      title: titleShape?.paragraphs.map((p) => p.text).join(' ') ?? '',
      shapes,
    });

    // The title is a heading, the body text is split into sentences.
    const blocks = [];
    if (titleShape) {
      blocks.push({
        kind: 'heading',
        text: titleShape.paragraphs.map((p) => p.text).join(' '),
      });
    }
    const bodyText = shapes
      .filter((shape) => shape.kind === 'text' && !shape.isTitle)
      .flatMap((shape) => shape.paragraphs.map((p) => p.text))
      .join('\n\n');
    blocks.push(...textToBlocks(bodyText));

    pages.push(blocks);
  }

  return {
    pages,
    source: { slides, width: SLIDE_WIDTH, height: slideHeight },
  };
};
