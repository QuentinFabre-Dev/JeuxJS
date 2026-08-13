/**
 * Real document analysis, powered by a local Ollama model.
 *
 * The document is sent page batch by page batch. Every sentence carries an id
 * (`p3s7`) and the model answers with those ids instead of rewriting the
 * original text: the sentence shown in the UI is therefore always the exact
 * sentence extracted from the file, which keeps the preview highlighting
 * reliable even when the model paraphrases.
 *
 * A final cross-page pass catches what per-batch prompts structurally cannot
 * see: terminology drift, acronyms redefined, figures that contradict each
 * other from one page to the next.
 */

import { chatJson, extractJson, OllamaError } from './ollamaClient.js';
import { DOC_TYPES, SERVICE_LINES, SKILLS } from '../data/constants.js';
import { languageLabel } from './languageDetect.js';

const PRIORITIES = ['low', 'medium', 'high'];

const uid = () => Math.random().toString(36).slice(2, 10);

const labelOf = (list, id) => list.find((item) => item.id === id)?.label ?? id;

export const SYSTEM_PROMPT = `You are a meticulous document quality reviewer working for a professional services firm.
You audit business documents and report concrete, actionable improvements.

Hard rules:
- Answer with a single valid JSON object. No prose, no code fence.
- Only report issues you can justify from the provided sentences. Never invent content.
- One finding per issue. Never report the same sentence twice for the same check.
- "suggestion" must be the full corrected sentence, ready to paste in place of the original.
- Ignore extraction artefacts (broken spacing, stray hyphens): they come from the file parser, not the author.
- If a batch of sentences is clean, return {"findings": []}.`;

const languageInstruction = (language) =>
  language && language !== 'en'
    ? `\nThe document is written in ${languageLabel(language)}. Write every suggestion AND every explanation in ${languageLabel(language)}, and apply the grammar and style conventions of that language.\n`
    : '';

const buildSentenceIndex = (documentModel) => {
  const index = new Map();
  documentModel.pages.forEach((blocks, pageIdx) => {
    blocks.forEach((block, blockIdx) => {
      if (block.kind !== 'p') return;
      index.set(`p${pageIdx + 1}s${blockIdx + 1}`, {
        page: pageIdx + 1,
        text: block.text,
        // Position of the sentence in the rendered page, when the format
        // provides one: this is what the viewer highlights.
        rects: block.rects,
        fromOcr: block.fromOcr === true,
      });
    });
  });
  return index;
};

/** Splits pages into batches of `pagesPerBatch`, keeping page numbers. */
const buildBatches = (documentModel, pagesPerBatch, pageFilter = null) => {
  const batches = [];
  for (let i = 0; i < documentModel.pages.length; i += pagesPerBatch) {
    const pages = documentModel.pages
      .slice(i, i + pagesPerBatch)
      .map((blocks, offset) => ({ pageNumber: i + offset + 1, blocks }))
      .filter((page) => !pageFilter || pageFilter.includes(page.pageNumber));

    const hasSentence = pages.some((page) =>
      page.blocks.some((block) => block.kind === 'p')
    );
    if (hasSentence) batches.push(pages);
  }
  return batches;
};

export const buildPrompt = ({
  batch,
  skills,
  customChecks,
  docType,
  serviceLine,
  language,
}) => {
  const activeSkills = SKILLS.filter((skill) => skills.includes(skill.id));

  const checkList = [
    ...activeSkills.map(
      (skill) => `- "${skill.id}" (${skill.label}): ${skill.description}`
    ),
    ...customChecks.map(
      (check) =>
        `- "custom" with custom_label "${check}": verify that the text complies with this client-specific requirement: ${check}`
    ),
  ].join('\n');

  const body = batch
    .map(({ pageNumber, blocks }) => {
      const lines = blocks
        .map((block, blockIdx) =>
          block.kind === 'heading'
            ? `[heading] ${block.text}`
            : `p${pageNumber}s${blockIdx + 1}: ${block.text}`
        )
        .join('\n');
      return `--- Page ${pageNumber} ---\n${lines}`;
    })
    .join('\n\n');

  return `Document type: ${labelOf(DOC_TYPES, docType)}
Service line: ${labelOf(SERVICE_LINES, serviceLine)}
${languageInstruction(language)}
Checks to run:
${checkList}

Sentences to review. Each one is prefixed by its id (for example "p2s5"); headings are context only and must not be reported:

${body}

Return this exact JSON object:
{
  "findings": [
    {
      "id": "the sentence id, copied exactly, e.g. p2s5",
      "skill": ${activeSkills.length ? `one of ${activeSkills.map((s) => `"${s.id}"`).join(', ')}` : '"custom"'}${customChecks.length ? ' or "custom"' : ''},
      "custom_label": "only for skill custom: the exact check name",
      "suggestion": "the corrected sentence in full",
      "explanation": "one short sentence explaining the issue",
      "priority": "low | medium | high",
      "confidence": 0.0 to 1.0
    }
  ]
}`;
};

/**
 * Sentences worth showing to a cross-page consistency pass: those carrying
 * figures, dates, acronyms or capitalised terms — the material inconsistencies
 * are actually made of.
 */
export const selectConsistencyCandidates = (sentenceIndex, limit = 120) => {
  const scored = [];
  for (const [id, sentence] of sentenceIndex.entries()) {
    const figures = (sentence.text.match(/\d[\d.,]*\s*(%|k|m|bn|€|\$|£)?/gi) ?? []).length;
    const acronyms = (sentence.text.match(/\b[A-Z]{2,6}\b/g) ?? []).length;
    const capitalised = (sentence.text.match(/\b[A-Z][a-z]{2,}\b/g) ?? []).length;
    const score = figures * 3 + acronyms * 2 + capitalised;
    if (score > 0) scored.push({ id, ...sentence, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.page - b.page);
};

export const buildConsistencyPrompt = ({ candidates, headings, docType, language }) => `Document type: ${labelOf(DOC_TYPES, docType)}
${languageInstruction(language)}
You are running a CROSS-PAGE consistency check on a document that was reviewed page by page.
Report only issues that require comparing DISTANT parts of the document:
- the same concept named differently from one page to another (terminology drift),
- an acronym used before being defined, or defined twice differently,
- figures, dates, amounts or totals that contradict each other,
- headings or numbering that do not follow the document's own structure.

Do NOT report isolated grammar, spelling or style issues: another pass already handled those.

Document outline:
${headings.map((heading) => `- p${heading.page}: ${heading.text}`).join('\n') || '- (no headings detected)'}

Key sentences, with their id and page:
${candidates.map((candidate) => `${candidate.id} (p${candidate.page}): ${candidate.text}`).join('\n')}

Return this exact JSON object:
{
  "findings": [
    {
      "id": "the id of the sentence that should be corrected",
      "skill": "consistency",
      "suggestion": "the corrected sentence in full",
      "explanation": "state explicitly which other page it contradicts",
      "priority": "low | medium | high",
      "confidence": 0.0 to 1.0
    }
  ]
}`;

/**
 * Pulls complete JSON objects out of a partially received answer.
 *
 * The answer is `{"findings":[{…},{…}]}`, so the objects worth emitting are the
 * array items, not the envelope: only capturing depth-0 objects would emit
 * nothing until the very last character, defeating the streaming.
 * Depth is relative to `from`, so resuming mid-array still works.
 *
 * @returns {{objects: Array, cursor: number}} objects found, and where to resume.
 */
export const scanCompleteObjects = (text, from = 0) => {
  const MAX_DEPTH = 2; // envelope + array items
  const objects = [];
  const starts = [];
  let cursor = from;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = from; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
      starts[depth] = i;
    } else if (char === '}') {
      if (depth === 0) continue;
      const start = starts[depth];
      if (start !== undefined && depth <= MAX_DEPTH) {
        try {
          objects.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          /* not valid on its own, skip it */
        }
      }
      starts[depth] = undefined;
      depth--;
      cursor = i + 1;
    }
  }

  return { objects, cursor };
};

const clampConfidence = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.75;
  const normalised = num > 1 ? num / 100 : num;
  return Number(Math.min(0.99, Math.max(0.3, normalised)).toFixed(2));
};

/** Turns a raw model object into a finding the UI can render, or null. */
export const normaliseFinding = (raw, { sentenceIndex, skills, customChecks }) => {
  if (!raw || typeof raw !== 'object') return null;

  const sentence = sentenceIndex.get(String(raw.id ?? '').trim());
  const suggestion = String(raw.suggestion ?? '').trim();
  if (!sentence || !suggestion) return null;
  // A "correction" identical to the original is noise.
  if (suggestion === sentence.text) return null;

  const rawSkill = String(raw.skill ?? '').trim().toLowerCase();
  const customLabel = String(raw.custom_label ?? raw.customLabel ?? '').trim();
  const isCustom = rawSkill === 'custom' || (!!customLabel && !skills.includes(rawSkill));

  if (isCustom && !customChecks.length) return null;
  if (!isCustom && !skills.includes(rawSkill)) return null;

  const priority = String(raw.priority ?? '').trim().toLowerCase();

  return {
    id: uid(),
    page: sentence.page,
    sentenceId: String(raw.id).trim(),
    original: sentence.text,
    ...(sentence.rects && { rects: sentence.rects }),
    suggestion,
    explanation:
      String(raw.explanation ?? '').trim() || 'No explanation provided.',
    priority: PRIORITIES.includes(priority) ? priority : 'medium',
    // A recognised page can misread characters: what looks like a typo may be
    // the OCR's, not the author's.
    confidence: sentence.fromOcr
      ? Number(Math.max(0.3, clampConfidence(raw.confidence) - 0.1).toFixed(2))
      : clampConfidence(raw.confidence),
    ...(sentence.fromOcr && { fromOcr: true }),
    skill: isCustom ? 'custom' : rawSkill,
    ...(isCustom && {
      customLabel:
        customChecks.find(
          (check) => check.toLowerCase() === customLabel.toLowerCase()
        ) ??
        customLabel ??
        'Custom',
    }),
  };
};

/** Position of a finding in reading order, used for document-order sorting. */
export const readingOrder = (finding) => {
  const match = /^p(\d+)s(\d+)$/.exec(finding.sentenceId ?? '');
  const page = match ? Number(match[1]) : (finding.page ?? 0);
  const sentence = match ? Number(match[2]) : 0;
  return page * 10000 + sentence;
};

/**
 * Runs the analysis and streams findings through `onFinding`.
 *
 * @returns {Promise<{findings: Array, aborted: boolean, errors: Array}>}
 */
export const runOllamaAnalysis = async ({
  documentModel,
  skills,
  customChecks = [],
  docType,
  serviceLine,
  language,
  settings,
  signal,
  pageFilter = null,
  crossPagePass = true,
  onFinding,
  onProgress,
  onBatchError,
}) => {
  if (!documentModel) throw new OllamaError('No parsed document to analyse.');

  const sentenceIndex = buildSentenceIndex(documentModel);
  const batches = buildBatches(
    documentModel,
    Math.max(1, settings.pagesPerBatch),
    pageFilter
  );

  const wantsConsistency = crossPagePass && skills.includes('consistency');
  // The cross-page pass only makes sense once the document spans several batches.
  const runsCrossPage = wantsConsistency && batches.length > 1 && !pageFilter;
  const stepCount = batches.length + (runsCrossPage ? 1 : 0);

  if (!batches.length || !sentenceIndex.size) {
    onProgress?.({ ratio: 1, step: 0, stepCount: 0, etaMs: 0 });
    return { findings: [], aborted: false, errors: [] };
  }

  const findings = [];
  const seen = new Set();
  const errors = [];
  const durations = [];

  const emit = (raw) => {
    const finding = normaliseFinding(raw, { sentenceIndex, skills, customChecks });
    if (!finding) return;
    const key = `${finding.original}::${finding.skill}::${finding.customLabel ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
    onFinding?.(finding);
  };

  /**
   * `step` is the number of completed steps; `label` describes what is running
   * right now — announcing a step after it finished tells the user nothing.
   */
  const reportProgress = (step, label) => {
    const average =
      durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : null;
    onProgress?.({
      ratio: step / stepCount,
      step,
      stepCount,
      label,
      etaMs: average === null ? null : Math.round(average * (stepCount - step)),
    });
  };

  /** One model call, streaming findings as their JSON objects complete. */
  const askModel = async (prompt) => {
    let cursor = 0;
    const startedAt = performance.now();

    const answer = await chatJson(settings.baseUrl, {
      model: settings.model,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: settings.temperature,
      numCtx: settings.numCtx,
      signal,
      onToken: (_token, content) => {
        const { objects, cursor: next } = scanCompleteObjects(content, cursor);
        cursor = next;
        objects.forEach(emit);
      },
    });

    durations.push(performance.now() - startedAt);

    // Safety net: a model may only close the array at the very end.
    const parsed = extractJson(answer);
    (Array.isArray(parsed.findings) ? parsed.findings : []).forEach(emit);
  };

  for (const [index, batch] of batches.entries()) {
    if (signal?.aborted) return { findings, aborted: true, errors };

    const pages = batch.map((page) => page.pageNumber);
    reportProgress(
      index,
      pages.length > 1
        ? `Pages ${pages[0]}–${pages.at(-1)} of ${documentModel.pages.length}`
        : `Page ${pages[0]} of ${documentModel.pages.length}`
    );

    try {
      await askModel(
        buildPrompt({ batch, skills, customChecks, docType, serviceLine, language })
      );
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) {
        return { findings, aborted: true, errors };
      }
      // A model that stumbles once must not cost two pages: retry once.
      try {
        await askModel(
          buildPrompt({ batch, skills, customChecks, docType, serviceLine, language })
        );
      } catch (retryError) {
        if (retryError.name === 'AbortError' || signal?.aborted) {
          return { findings, aborted: true, errors };
        }
        errors.push({ pages, error: retryError });
        onBatchError?.(retryError, pages);
      }
    }

    reportProgress(index + 1, runsCrossPage ? null : 'Wrapping up');
  }

  if (runsCrossPage && !signal?.aborted && errors.length < batches.length) {
    const candidates = selectConsistencyCandidates(sentenceIndex);
    const headings = documentModel.pages.flatMap((blocks, pageIdx) =>
      blocks
        .filter((block) => block.kind === 'heading')
        .map((block) => ({ page: pageIdx + 1, text: block.text }))
    );

    if (candidates.length > 1) {
      reportProgress(batches.length, 'Cross-page consistency check');
      try {
        await askModel(
          buildConsistencyPrompt({ candidates, headings, docType, language })
        );
      } catch (error) {
        if (error.name !== 'AbortError' && !signal?.aborted) {
          errors.push({ pages: ['cross-page'], error });
          onBatchError?.(error, ['cross-page']);
        }
      }
    }
    reportProgress(stepCount, 'Wrapping up');
  }

  if (errors.length === batches.length && batches.length > 0) {
    throw errors[0].error;
  }

  return { findings, aborted: false, errors };
};

/**
 * Global document score (0-100).
 *
 * Normalised by document length: 20 findings in a 2-page memo and 20 findings
 * in a 100-page report are not the same defect density, and an absolute count
 * would rank the long document as the worst one every time.
 */
export const computeDocumentScore = (findings, { sentenceCount } = {}) => {
  if (!findings || findings.length === 0) return 100;

  const weights = { high: 6, medium: 3, low: 1 };
  const penalty = findings.reduce(
    (sum, finding) => sum + (weights[finding.priority] ?? 1),
    0
  );

  // Without a length reference (demo mode) fall back to the absolute scale.
  if (!sentenceCount || sentenceCount < 10) {
    return Math.round(Math.max(40, 100 - Math.min(penalty, 60)));
  }

  const penaltyPer100Sentences = (penalty / sentenceCount) * 100;
  return Math.round(Math.max(40, 100 - Math.min(penaltyPer100Sentences * 0.8, 60)));
};

/** Number of reviewable sentences, used to calibrate the score. */
export const countSentences = (documentModel) =>
  documentModel
    ? documentModel.pages
        .flat()
        .filter((block) => block.kind === 'p').length
    : 0;
