/**
 * Contract check: the deliverable against the signed statement of work.
 *
 * Its own endpoint rather than a check inside `/api/analyze`, because it
 * answers a different question and returns a different shape. A quality
 * finding points at a sentence that is wrong; a contract gap points at a
 * sentence that is **missing**, and there is nothing to highlight for that.
 *
 * Two passes, streamed: read the SoW and list what was promised, then check
 * each promise against the deliverable. The commitments are sent to the
 * browser as soon as they are known, so the panel fills in while the verdicts
 * are still being decided.
 */
import { eventStream } from '../../../lib/sse.js';
import { runPool } from '../../../lib/checks/pool.js';
import { batchCommitments, rollup } from '../../../lib/checks/sow.js';
import { extractCommitments, verifyCommitments } from '../../../lib/checks/runner.js';
import { documentSentences } from '../../../lib/checks/sentences.js';
import { requireSession, unauthorised } from '../../../lib/session.js';
import { rateLimit, refuseOversized, visitorKey } from '../../../lib/limits.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Sixty seconds is the ceiling of Vercel's Hobby plan; declaring more fails
// the build there. Raise it in `vercel.json` on a paid plan.
export const maxDuration = 60;

const CONCURRENCY = Number(process.env.ANALYSIS_CONCURRENCY ?? 12);

export async function POST(request) {
  if (!(await requireSession())) return unauthorised();

  const body = await request.json().catch(() => null);
  if (!body?.documentModel?.pages || !body?.sowModel?.pages) {
    return Response.json({ error: 'Livrable et SoW requis.' }, { status: 400 });
  }

  const oversized = refuseOversized({
    pageCount: body.documentModel.pages.length + body.sowModel.pages.length,
    callCount: 0,
  });
  if (oversized) return Response.json({ error: oversized }, { status: 413 });

  const quota = rateLimit(visitorKey(request));
  if (!quota.allowed) return Response.json({ error: quota.reason }, { status: 429 });

  return eventStream(
    check({
      sentences: documentSentences(body.documentModel),
      sowSentences: documentSentences(body.sowModel),
      language: body.language,
      signal: request.signal,
    })
  );
}

async function* check(context) {
  const usage = {};
  const account = (report) => {
    const bucket = (usage.main ??= { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
    bucket.inputTokens += report.inputTokens;
    bucket.outputTokens += report.outputTokens;
    bucket.cachedInputTokens += report.cachedInputTokens;
  };

  let commitments = [];
  try {
    const extracted = await extractCommitments(context);
    commitments = extracted.commitments;
    account(extracted.usage);
  } catch (error) {
    if (error.name === 'AbortError') return;
    yield ['error', { message: `Lecture du SoW impossible : ${error.message}` }];
    return;
  }

  // Nothing to check is a legitimate answer, and a loud one: a statement of
  // work with no traceable obligation is itself worth telling the user about.
  yield ['plan', { tasks: commitments, byEngine: { llm: commitments.length } }];
  if (!commitments.length) {
    yield ['end', { findings: 0, usage, compliance: rollup([], []) }];
    return;
  }

  const batches = batchCommitments(commitments).map((batch, index) => ({
    id: `sow:${index}`,
    check: 'sow',
    batch,
  }));

  const verdicts = [];

  for await (const outcome of runPool(
    batches,
    (task) => verifyCommitments(task.batch, context),
    { concurrency: CONCURRENCY }
  )) {
    if (outcome.error) {
      if (outcome.error.name === 'AbortError') return;
      // A packet that fails leaves its commitments unchecked, and the summary
      // counts them as such — never as honoured.
      yield ['error', { task: outcome.task.id, message: outcome.error.message }];
      continue;
    }

    account(outcome.value.usage);
    for (const verdict of outcome.value.verdicts) {
      verdicts.push(verdict);
      const commitment = outcome.task.batch.find((entry) => entry.id === verdict.id);
      yield ['verdict', { ...verdict, commitment }];
    }
    yield ['done', { task: outcome.task.id, count: outcome.value.verdicts.length }];
  }

  yield ['end', { findings: verdicts.length, usage, compliance: rollup(commitments, verdicts) }];
}
