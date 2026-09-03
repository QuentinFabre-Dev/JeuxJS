/**
 * A review, from the browser's point of view.
 *
 * Two engines run at once, and the order matters for what the user sees: the
 * deterministic checks land in the first fraction of a second, then the model
 * findings stream in over the next twenty. Nobody waits in front of an empty
 * list.
 *
 * Both engines produce candidates in the same shape and both go through
 * `normaliseFinding`: whatever found an issue, a finding is anchored to a real
 * sentence of the real file, or it does not exist.
 */
import { normaliseFinding } from './analysisService.js';
import { streamReview } from './reviewStream.js';
import { planTasks } from '../../lib/checks/planner.js';
import { checkById } from '../../lib/checks/registry.js';
import { runLocalChecks, splitRequirements } from '../../lib/checks/local/index.js';
import { documentSentences, forTransport } from '../../lib/checks/sentences.js';

/** Builds the id → sentence map the normaliser anchors findings with. */
const sentenceIndex = (documentModel) => {
  const index = new Map();
  documentModel.pages.forEach((blocks, pageIndex) => {
    blocks.forEach((block, blockIndex) => {
      if (block.kind !== 'p') return;
      index.set(`p${pageIndex + 1}s${blockIndex + 1}`, {
        page: pageIndex + 1,
        text: block.text,
        rects: block.rects,
        fromOcr: block.fromOcr === true,
      });
    });
  });
  return index;
};

export const runCloudReview = async ({
  documentModel,
  skills,
  customChecks = [],
  glossary = [],
  docType,
  serviceLine,
  language,
  signal,
  onFinding,
  onProgress,
  onCheckError,
}) => {
  const index = sentenceIndex(documentModel);
  const sentences = documentSentences(documentModel);
  const selection = [...skills, ...(customChecks.length ? ['custom'] : [])];
  const { pattern, semantic } = splitRequirements(customChecks);

  const seen = new Set();
  const emit = (raw) => {
    const finding = normaliseFinding(raw, {
      sentenceIndex: index,
      skills,
      customChecks,
    });
    if (!finding) return;
    // Two checks can land on the same sentence for the same reason; the
    // reader should see it once.
    const key = `${finding.sentenceId}::${finding.skill}::${finding.customLabel ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    onFinding?.(finding);
  };

  const tasks = planTasks({ skills: selection, pageCount: documentModel.pages.length });
  const localChecks = tasks
    .filter((task) => task.engine === 'local')
    .map((task) => task.check);
  const modelTasks = tasks.filter((task) => task.engine === 'llm');

  let completed = 0;
  const total = localChecks.length + modelTasks.length;
  const advance = (label) => {
    completed += 1;
    onProgress?.({
      ratio: total ? completed / total : 1,
      step: completed,
      stepCount: total,
      label,
    });
  };

  // Free and instant: run them first so the list is never empty for long.
  for (const id of localChecks) {
    for (const raw of runLocalChecks([id], sentences, {
      glossary,
      requirements: pattern,
    })) {
      emit(raw);
    }
    advance(checkById(id)?.label);
  }

  if (!modelTasks.length) {
    onProgress?.({ ratio: 1, step: total, stepCount: total });
    return { usage: null };
  }

  const summary = await streamReview(
    {
      documentModel: forTransport(documentModel),
      skills: selection,
      docType,
      serviceLine,
      language,
      glossary,
      // Requirements settled by a search were handled above; sending them to
      // the model would produce the same finding twice.
      requirements: semantic,
    },
    {
      onFinding: emit,
      onDone: (taskId) => advance(checkById(taskId.split(':')[0])?.label),
      onError: (message, taskId) => {
        advance();
        onCheckError?.(message, taskId);
      },
    },
    signal
  );

  return summary;
};
