/**
 * Real document analysis, powered by a local Ollama model.
 *
 * The document is sent page batch by page batch. Every sentence carries an id
 * (`p3s7`) and the model answers with those ids instead of rewriting the
 * original text: the sentence shown in the UI is therefore always the exact
 * sentence extracted from the file, which keeps the preview highlighting
 * reliable even when the model paraphrases.
 */

import { chatJson, extractJson, OllamaError } from './ollamaClient.js';
import { DOC_TYPES, SERVICE_LINES, SKILLS } from '../data/constants.js';

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

const buildSentenceIndex = (documentModel) => {
  const index = new Map();
  documentModel.pages.forEach((blocks, pageIdx) => {
    blocks.forEach((block, blockIdx) => {
      if (block.kind !== 'p') return;
      index.set(`p${pageIdx + 1}s${blockIdx + 1}`, {
        page: pageIdx + 1,
        text: block.text,
      });
    });
  });
  return index;
};

/** Splits pages into batches of `pagesPerBatch`, keeping page numbers. */
const buildBatches = (documentModel, pagesPerBatch) => {
  const batches = [];
  for (let i = 0; i < documentModel.pages.length; i += pagesPerBatch) {
    const pages = documentModel.pages
      .slice(i, i + pagesPerBatch)
      .map((blocks, offset) => ({ pageNumber: i + offset + 1, blocks }));
    const hasSentence = pages.some((page) =>
      page.blocks.some((block) => block.kind === 'p')
    );
    if (hasSentence) batches.push(pages);
  }
  return batches;
};

export const buildPrompt = ({ batch, skills, customChecks, docType, serviceLine }) => {
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
 * Pulls complete JSON objects out of a partially received answer.
 * Returns the objects found and the offset to resume from next time.
 */
export const scanCompleteObjects = (text, from = 0) => {
  const objects = [];
  let cursor = from;
  let depth = 0;
  let start = -1;
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

    if (char === '"') inString = true;
    else if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      if (depth === 0) continue;
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          objects.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          /* not a finding object, skip it */
        }
        cursor = i + 1;
        start = -1;
      }
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
    original: sentence.text,
    suggestion,
    explanation:
      String(raw.explanation ?? '').trim() || 'No explanation provided.',
    priority: PRIORITIES.includes(priority) ? priority : 'medium',
    confidence: clampConfidence(raw.confidence),
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

/**
 * Runs the analysis and streams findings through `onFinding`.
 *
 * @returns {Promise<{findings: Array, score: number, aborted: boolean}>}
 */
export const runOllamaAnalysis = async ({
  documentModel,
  skills,
  customChecks = [],
  docType,
  serviceLine,
  settings,
  signal,
  onFinding,
  onProgress,
  onBatchError,
}) => {
  if (!documentModel) throw new OllamaError('No parsed document to analyse.');

  const sentenceIndex = buildSentenceIndex(documentModel);
  const batches = buildBatches(documentModel, Math.max(1, settings.pagesPerBatch));

  if (!batches.length || !sentenceIndex.size) {
    onProgress?.(1);
    return { findings: [], score: 100, aborted: false };
  }

  const findings = [];
  const seen = new Set();
  const errors = [];

  const emit = (raw) => {
    const finding = normaliseFinding(raw, { sentenceIndex, skills, customChecks });
    if (!finding) return;
    const key = `${finding.original}::${finding.skill}::${finding.customLabel ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
    onFinding?.(finding);
  };

  for (const [index, batch] of batches.entries()) {
    if (signal?.aborted) {
      return { findings, score: computeDocumentScore(findings), aborted: true };
    }

    let cursor = 0;
    const prompt = buildPrompt({ batch, skills, customChecks, docType, serviceLine });

    try {
      const answer = await chatJson(settings.baseUrl, {
        model: settings.model,
        system: SYSTEM_PROMPT,
        prompt,
        temperature: settings.temperature,
        numCtx: settings.numCtx,
        signal,
        onToken: (_token, content) => {
          // Emit findings as soon as their JSON object is complete.
          const { objects, cursor: next } = scanCompleteObjects(content, cursor);
          cursor = next;
          objects.forEach(emit);
        },
      });

      // Safety net: the streaming scanner misses nothing in practice, but a
      // model may close the array only at the very end.
      const parsed = extractJson(answer);
      (Array.isArray(parsed.findings) ? parsed.findings : []).forEach(emit);
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) {
        return { findings, score: computeDocumentScore(findings), aborted: true };
      }
      // One failed batch must not kill the whole run.
      errors.push({ pages: batch.map((page) => page.pageNumber), error });
      onBatchError?.(error, batch.map((page) => page.pageNumber));
    }

    onProgress?.((index + 1) / batches.length);
  }

  if (errors.length === batches.length) {
    throw errors[0].error;
  }

  return { findings, score: computeDocumentScore(findings), aborted: false, errors };
};

/**
 * Global document score (0-100). High-priority findings weigh more.
 * Kept identical to the demo engine so both modes stay comparable.
 */
export const computeDocumentScore = (findings) => {
  if (!findings || findings.length === 0) return 100;
  const weights = { high: 6, medium: 3, low: 1 };
  const penalty = findings.reduce(
    (sum, finding) => sum + (weights[finding.priority] ?? 1),
    0
  );
  return Math.round(Math.max(40, 100 - Math.min(penalty, 60)));
};
