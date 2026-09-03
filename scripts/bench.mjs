/**
 * The evaluation bench.
 *
 * Every duration and every price quoted in `docs/plan-cloud-qa.md` is an
 * estimate until this script has run. Its job is to replace them — and to
 * correct them when they are wrong, rather than to defend them.
 *
 * Two modes, and the difference matters:
 *
 *   npm run bench            the deterministic checks only. No key, no cost,
 *                            no network: runnable by anyone, on every commit.
 *   npm run bench -- --model the full review. Calls the API and spends real
 *                            money; asks nothing, so read the estimate it
 *                            prints before answering yes.
 *
 * `--tier nano|fast|main` re-runs the mechanical pass on another tier, which
 * is how the "does spelling need the big model" question gets an answer
 * instead of an opinion.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { planTasks } from '../lib/checks/planner.js';
import { estimateReview, formatCost, formatDuration, actualCost } from '../lib/checks/estimate.js';
import { runLocalChecks, splitRequirements } from '../lib/checks/local/index.js';
import { documentSentences } from '../lib/checks/sentences.js';
import { packFor } from '../lib/checks/domains/index.js';
import { runPool } from '../lib/checks/pool.js';
import { scoreFindings, percent } from '../bench/score.js';

const args = process.argv.slice(2);
const withModel = args.includes('--model');
const tierOverride = args[args.indexOf('--tier') + 1];

const CORPUS_DIR = join(process.cwd(), 'bench', 'corpus');
const corpus = readdirSync(CORPUS_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf8')));

const ALL_SKILLS = ['spelling', 'grammar', 'clarity', 'tone', 'consistency', 'custom'];

const localFindings = (document) => {
  const sentences = documentSentences(document);
  const pack = packFor(document.serviceLine);
  const { pattern } = splitRequirements([...(document.customChecks ?? []), ...pack.requirements]);

  const tasks = planTasks({ skills: ALL_SKILLS, pageCount: document.pages.length });
  const checks = tasks.filter((task) => task.engine === 'local').map((task) => task.check);

  const started = performance.now();
  const findings = runLocalChecks(checks, sentences, {
    glossary: pack.glossary,
    requirements: pattern,
  });
  return { findings, seconds: (performance.now() - started) / 1000 };
};

const modelFindings = async (document) => {
  const { runTask } = await import('../lib/checks/runner.js');
  const sentences = documentSentences(document);
  const pack = packFor(document.serviceLine);
  const { semantic } = splitRequirements([...(document.customChecks ?? []), ...pack.requirements]);

  const tasks = planTasks({ skills: ALL_SKILLS, pageCount: document.pages.length }).filter(
    (task) => task.engine === 'llm'
  );

  const context = {
    docType: document.docType,
    serviceLine: document.serviceLine,
    language: document.language,
    domain: pack.context,
    glossary: pack.glossary,
    requirements: semantic,
  };

  const findings = [];
  const usage = {};
  const started = performance.now();

  for await (const outcome of runPool(
    tasks,
    (task) => runTask(task, { documentModel: document, sentences, context }),
    { concurrency: 12 }
  )) {
    if (outcome.error) {
      console.error(`  ✘ ${outcome.task.id} : ${outcome.error.message}`);
      continue;
    }
    findings.push(...outcome.value.findings);
    const tier = outcome.task.check === 'mechanical' ? 'fast' : 'main';
    const bucket = (usage[tier] ??= { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
    bucket.inputTokens += outcome.value.usage.inputTokens;
    bucket.outputTokens += outcome.value.usage.outputTokens;
    bucket.cachedInputTokens += outcome.value.usage.cachedInputTokens;
  }

  return { findings, usage, seconds: (performance.now() - started) / 1000 };
};

const report = (label, score, seconds, dollars) => {
  console.log(
    `  ${label.padEnd(16)} P ${percent(score.precision).padStart(4)} · ` +
      `R ${percent(score.recall).padStart(4)} · F1 ${percent(score.f1).padStart(4)} · ` +
      `${formatDuration(seconds).padEnd(9)} ${dollars === null ? 'free' : formatCost(dollars)}`
  );
  for (const missed of score.missed) console.log(`      manqué   ${missed}`);
  for (const wrong of score.falsePositives) console.log(`      à tort   ${wrong}`);
};

const main = async () => {
  if (tierOverride) {
    process.env.ANALYSIS_MODEL_FAST =
      { nano: 'gpt-5-nano', fast: 'gpt-5-mini', main: 'gpt-5' }[tierOverride] ?? tierOverride;
    console.log(`Palier mécanique forcé : ${process.env.ANALYSIS_MODEL_FAST}\n`);
  }

  if (withModel) {
    const estimate = corpus.reduce(
      (total, document) =>
        total +
        estimateReview(planTasks({ skills: ALL_SKILLS, pageCount: document.pages.length })).dollars,
      0
    );
    console.log(
      `Ce banc appelle l'API sur ${corpus.length} documents. Coût estimé : ${formatCost(estimate)}.`
    );
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Continuer ? [o/N] ');
    rl.close();
    if (!/^o(ui)?$/i.test(answer.trim())) {
      console.log('Annulé.');
      return;
    }
    console.log('');
  }

  for (const document of corpus) {
    console.log(`${document.name} — ${document.pages.length} pages, ${document.expected.length} défauts attendus`);

    const local = localFindings(document);
    report(
      'déterministes',
      scoreFindings(local.findings, document.expected.filter((entry) => entry.skill === 'consistency' || entry.skill === 'custom')),
      local.seconds,
      null
    );

    if (!withModel) {
      console.log('');
      continue;
    }

    const model = await modelFindings(document);
    const all = [...local.findings, ...model.findings];
    report('revue complète', scoreFindings(all, document.expected), local.seconds + model.seconds, actualCost(model.usage).dollars);
    console.log('');
  }

  if (!withModel) {
    console.log(
      'Seuls les contrôles déterministes ont tourné. `npm run bench -- --model` mesure la revue complète.'
    );
  }
};

main();
