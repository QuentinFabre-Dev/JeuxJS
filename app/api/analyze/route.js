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
import { runCritic, runTask } from '../../../lib/checks/runner.js';
import {
  DEFAULT_POLICY,
  applyVerdicts,
  batchCandidates,
  dropRate,
  toVerify,
} from '../../../lib/checks/critic.js';
import { documentSentences } from '../../../lib/checks/sentences.js';
import { packFor } from '../../../lib/checks/domains/index.js';
import { requireSession, unauthorised } from '../../../lib/session.js';
import { rateLimit, refuseOversized, visitorKey } from '../../../lib/limits.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A ten-page review lands in about twenty seconds, so sixty is comfortable —
// and sixty is also the ceiling of Vercel's Hobby plan. Declaring more there
// fails the build, which is a deployment that does not exist rather than a
// deployment that is slow. Raise it in `vercel.json` on a paid plan when long
// documents need it.
export const maxDuration = 60;

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

  // Refused before a single call goes out: a review that would cost too much
  // must not cost anything at all.
  const oversized = refuseOversized({
    pageCount: documentModel.pages.length,
    callCount: tasks.length,
  });
  if (oversized) return Response.json({ error: oversized }, { status: 413 });

  const quota = rateLimit(visitorKey(request));
  if (!quota.allowed) return Response.json({ error: quota.reason }, { status: 429 });

  return eventStream(
    review(tasks, {
      documentModel,
      // Built here rather than trusted from the client: the ids the model
      // answers with must match what the browser will highlight.
      sentences: documentSentences(documentModel),
      context: (() => {
        // The pack is resolved here, not trusted from the client: a glossary
        // decides what is *not* a mistake, so it must come from the versioned
        // code rather than from a request body.
        const pack = packFor(body.serviceLine);
        return {
          docType: body.docType,
          serviceLine: body.serviceLine,
          language: body.language,
          domain: pack.context,
          glossary: [...pack.glossary, ...(body.glossary ?? [])],
          requirements: [...(body.requirements ?? []), ...pack.requirements],
        };
      })(),
      policy: body.criticPolicy ?? DEFAULT_POLICY,
      signal: request.signal,
    })
  );
}

async function* review(tasks, context) {
  yield ['plan', { tasks, byEngine: taskCountByEngine(tasks) }];

  const candidates = [];
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

    for (const [index, finding] of outcome.value.findings.entries()) {
      // A reference the verdict can name later: the finding is shown now,
      // before it is verified, so nobody waits on the critic to see results.
      const stamped = {
        ...finding,
        ref: `${outcome.task.id}#${index}`,
        check: outcome.task.check,
        verified: false,
      };
      candidates.push(stamped);
      yield ['finding', { task: outcome.task.id, finding: stamped }];
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

  // Verification. It runs after the checks rather than between them, which
  // costs one extra wave on the total and nothing at all on the time to first
  // finding — the cards are already on screen, the verdicts amend them.
  const pending = toVerify(candidates, context.policy);
  let decisions = [];

  if (pending.length) {
    const batches = batchCandidates(pending).map((batch, index) => ({
      id: `critic:${index}`,
      check: 'critic',
      batch,
    }));

    const sentenceOf = (id) =>
      context.sentences.find((sentence) => sentence.id === id)?.text;

    for await (const outcome of runPool(
      batches,
      (task) => runCritic(task.batch, { sentenceOf, signal: context.signal }),
      { concurrency: CONCURRENCY }
    )) {
      if (outcome.error) {
        if (outcome.error.name === 'AbortError') return;
        // Verification failing leaves the findings as they are: unverified is
        // a state the interface knows how to show, a missing review is not.
        yield ['error', { task: outcome.task.id, message: outcome.error.message }];
        continue;
      }

      const batchDecisions = applyVerdicts(outcome.task.batch, outcome.value.verdicts);
      decisions = decisions.concat(batchDecisions);
      for (const decision of batchDecisions) yield ['verdict', decision];

      const bucket = (usage.fast ??= {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
      });
      bucket.inputTokens += outcome.value.usage.inputTokens;
      bucket.outputTokens += outcome.value.usage.outputTokens;
      bucket.cachedInputTokens += outcome.value.usage.cachedInputTokens;
    }
  }

  yield [
    'end',
    {
      findings: candidates.length,
      usage,
      // A critic that never rejects anything is a critic to switch off; the
      // only way to notice is to publish the figure.
      verification: pending.length
        ? { checked: pending.length, dropRate: dropRate(decisions) }
        : null,
    },
  ];
}
