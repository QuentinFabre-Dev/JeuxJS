/**
 * The review endpoint.
 *
 * One POST, one server-sent event stream: the plan first, then every finding as
 * it lands, then a final summary. The client never polls, and a review that
 * takes twenty seconds shows its first result after one.
 *
 * Only the checks that need judgement come through here. Spelling, grammar,
 * terminology and figures are settled by deterministic engines that cost
 * nothing — see `lib/checks/registry.js`.
 */
import { eventStream } from '../../../lib/sse.js';
import { runPool } from '../../../lib/checks/pool.js';
import { planTasks, taskCountByEngine } from '../../../lib/checks/planner.js';
import { checkById } from '../../../lib/checks/registry.js';
import { runTask } from '../../../lib/checks/runner.js';
import { documentSentences } from '../../../lib/checks/sentences.js';
import { requireSession, unauthorised } from '../../../lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A ten-page review lands in about twenty seconds; the ceiling is there for the
// long documents, not the normal case.
export const maxDuration = 300;

const CONCURRENCY = Number(process.env.ANALYSIS_CONCURRENCY ?? 12);

export async function POST(request) {
  if (!(await requireSession())) return unauthorised();

  const body = await request.json().catch(() => null);
  if (!body?.documentModel?.pages) {
    return Response.json({ error: 'Document manquant.' }, { status: 400 });
  }

  const { documentModel, skills = [], pagesPerBatch = 1 } = body;
  const tasks = planTasks({
    skills,
    pageCount: documentModel.pages.length,
    pagesPerBatch,
  }).filter((task) => task.engine === 'llm');

  return eventStream(
    review(tasks, {
      documentModel,
      // Built here rather than trusted from the client: the ids the model
      // answers with must match what the browser will highlight.
      sentences: documentSentences(documentModel),
      context: {
        docType: body.docType,
        serviceLine: body.serviceLine,
        language: body.language,
        glossary: body.glossary ?? [],
        requirements: body.requirements ?? [],
      },
      signal: request.signal,
    })
  );
}

async function* review(tasks, context) {
  yield ['plan', { tasks, byEngine: taskCountByEngine(tasks) }];

  const findings = [];
  // Kept per tier: the two models' tokens do not cost the same, so a single
  // total could not be turned back into a price.
  const usage = {};

  for await (const outcome of runPool(tasks, (task) => runTask(task, context), {
    concurrency: CONCURRENCY,
  })) {
    if (outcome.error) {
      if (outcome.error.name === 'AbortError') return;
      // One check failing is not the review failing: report it and carry on.
      yield ['error', { task: outcome.task.id, message: outcome.error.message }];
      continue;
    }

    for (const finding of outcome.value.findings) {
      findings.push(finding);
      yield ['finding', { task: outcome.task.id, finding }];
    }
    const tier = checkById(outcome.task.check)?.model ?? 'main';
    const bucket = (usage[tier] ??= {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    bucket.inputTokens += outcome.value.usage?.inputTokens ?? 0;
    bucket.outputTokens += outcome.value.usage?.outputTokens ?? 0;
    bucket.cachedInputTokens += outcome.value.usage?.cachedInputTokens ?? 0;

    yield ['done', { task: outcome.task.id, count: outcome.value.findings.length }];
  }

  yield ['end', { findings: findings.length, usage }];
}
