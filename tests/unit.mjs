/**
 * Unit tests for the pure functions of the analysis pipeline.
 * No test runner, no dependency: `npm test`.
 *
 * These cover the parts where a silent regression is most costly — the
 * streaming JSON scanner, the normalisation of model output, the score
 * calibration and the sentence splitting.
 */
import {
  selectConsistencyCandidates,
  scanCompleteObjects,
  normaliseFinding,
  computeDocumentScore,
  readingOrder,
} from '../src/services/analysisService.js';
import { detectLanguage } from '../src/services/languageDetect.js';
import { joinPdfLines } from '../src/services/documentParser.js';
import { splitSentences, textToBlocks } from '../src/services/textBlocks.js';
import { REVIEW_STATES, toggleState, stateOf } from '../src/data/review.js';
import { buildMessages } from '../src/services/ollamaClient.js';
import { parseSseChunk } from '../src/services/deepseekClient.js';
import { activeModel, activeBaseUrl, isCloudProvider } from '../src/config/providers.js';
import { encodeEvent, decodeEvent } from '../lib/sse.js';
import { runPool } from '../lib/checks/pool.js';
import { planTasks, taskCountByEngine } from '../lib/checks/planner.js';
import { issueSession, verifySession, authDisabled } from '../lib/auth.js';

let failures = 0;
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${label}${ok ? '' : ` — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`}`);
};
const ok = (label, value) => eq(label, !!value, true);

// ── selectConsistencyCandidates : couvre toutes les pages ───
const index = new Map();
for (let page = 1; page <= 5; page++) {
  for (let s = 1; s <= 10; s++) {
    index.set(`p${page}s${s}`, { page, text: `The EBITDA margin was ${s * page} percent in ${2000 + s} for the PMO.` });
  }
}
const candidates = selectConsistencyCandidates(index);
ok('candidats issus de toutes les pages', new Set(candidates.map((c) => c.page)).size === 5);
ok('candidats triés par page', candidates.every((c, i, arr) => i === 0 || arr[i - 1].page <= c.page));
eq('limite respectée', selectConsistencyCandidates(index, 7).length, 7);
eq('phrases sans repère ignorées', selectConsistencyCandidates(new Map([['p1s1', { page: 1, text: 'a b c' }]])).length, 0);

// ── scanCompleteObjects : JSON partiel en streaming ─────────
const stream = '{"findings":[{"id":"p1s1","suggestion":"a"},{"id":"p1s2","suggestion":"b"}]}';
let cursor = 0;
const collected = [];
for (let i = 1; i <= stream.length; i++) {
  const { objects, cursor: next } = scanCompleteObjects(stream.slice(0, i), cursor);
  cursor = next;
  collected.push(...objects);
}
eq('objets extraits pendant le streaming', collected.map((o) => o.id), ['p1s1', 'p1s2']);
eq(
  'accolade dans une chaîne ignorée',
  scanCompleteObjects('{"a":"} {"}').objects,
  [{ a: '} {' }]
);

// ── normaliseFinding : filtrage des sorties du modèle ───────
const idx = new Map([['p1s1', { page: 1, text: 'Original sentence.' }]]);
const ctx = { sentenceIndex: idx, skills: ['grammar'], customChecks: [] };
eq('id inconnu rejeté', normaliseFinding({ id: 'p9s9', suggestion: 'x', skill: 'grammar' }, ctx), null);
eq('suggestion identique rejetée', normaliseFinding({ id: 'p1s1', suggestion: 'Original sentence.', skill: 'grammar' }, ctx), null);
eq('skill non sélectionné rejeté', normaliseFinding({ id: 'p1s1', suggestion: 'y', skill: 'tone' }, ctx), null);
const good = normaliseFinding({ id: 'p1s1', suggestion: 'Fixed.', skill: 'GRAMMAR', priority: 'HIGH', confidence: 91 }, ctx);
eq('priorité normalisée', good.priority, 'high');
eq('confiance en pourcentage ramenée à [0,1]', good.confidence, 0.91);
eq('texte original repris du document', good.original, 'Original sentence.');
eq('priorité inconnue → medium', normaliseFinding({ id: 'p1s1', suggestion: 'z', skill: 'grammar', priority: 'urgent' }, ctx).priority, 'medium');

// ── score calibré par longueur ──────────────────────────────
const twenty = Array.from({ length: 20 }, () => ({ priority: 'high' }));
const shortDoc = computeDocumentScore(twenty, { sentenceCount: 40 });
const longDoc = computeDocumentScore(twenty, { sentenceCount: 2000 });
ok('même nombre de findings : doc court plus pénalisé', shortDoc < longDoc);
eq('document sans finding', computeDocumentScore([], { sentenceCount: 100 }), 100);
eq('plancher à 40', computeDocumentScore(twenty, { sentenceCount: 12 }), 40);

// ── ordre de lecture ────────────────────────────────────────
const order = [
  { sentenceId: 'p2s3', page: 2 },
  { sentenceId: 'p1s10', page: 1 },
  { sentenceId: 'p1s2', page: 1 },
].sort((a, b) => readingOrder(a) - readingOrder(b));
eq('tri par ordre de lecture', order.map((f) => f.sentenceId), ['p1s2', 'p1s10', 'p2s3']);

// ── détection de langue ─────────────────────────────────────
eq(
  'français détecté',
  detectLanguage("Le rapport présente les chiffres clés pour le dernier trimestre et les équipes qui ont travaillé sur ce dossier dans les délais avec une attention particulière pour la qualité des livrables remis").id,
  'fr'
);
eq(
  'anglais détecté',
  detectLanguage('The report presents the key figures for the last quarter and the teams that have been working on this file with a particular attention to the quality of the deliverables that were sent').id,
  'en'
);
eq('échantillon trop court → défaut', detectLanguage('Bonjour').id, 'en');

// ── découpage en phrases ────────────────────────────────────
eq(
  'phrases séparées',
  splitSentences('First one. Second one! Third one?'),
  ['First one.', 'Second one!', 'Third one?']
);
eq('titre numéroté détecté', textToBlocks('1. Introduction\n\nHello there.')[0].kind, 'heading');

// ── reconstitution des paragraphes d'un PDF ─────────────────
// Un PDF n'a pas de paragraphes : seules des lignes. Un titre court collé au
// texte suivant produisait des fragments de phrase comme « 1. ».
eq(
  'titre court isolé du texte qui suit',
  joinPdfLines('1. Introduction\nThis document is fine. It continues here.'),
  '1. Introduction\n\nThis document is fine. It continues here.'
);
eq(
  'ligne coupée au milieu d\'une phrase recollée',
  joinPdfLines('The sales and marketing teams needs to collaborate much\nmore closely with everyone.'),
  'The sales and marketing teams needs to collaborate much more closely with everyone.'
);
eq(
  'césure recollée sans tiret',
  joinPdfLines('collabo-\nration'),
  'collaboration'
);
eq('ligne vide = nouveau paragraphe', joinPdfLines('A line here.\n\nAnother one.'), 'A line here.\n\nAnother one.');

eq(
  'numéro seul fusionné avec la phrase suivante',
  splitSentences('1. Introduction of the report.'),
  ['1. Introduction of the report.']
);
eq(
  'phrases normales non fusionnées',
  splitSentences('First sentence here. Second sentence here.'),
  ['First sentence here.', 'Second sentence here.']
);

// ── compatibilité des gabarits de conversation ──────────────
// Gemma n'a pas de tour « system » : une consigne envoyée séparément peut être
// perdue, et avec elle toutes les règles de la revue.
eq(
  'llama garde un tour system distinct',
  buildMessages('llama3.1:8b', 'RULES', 'TEXT').map((m) => m.role),
  ['system', 'user']
);
eq(
  'gemma reçoit les règles dans le message utilisateur',
  buildMessages('gemma3:12b', 'RULES', 'TEXT'),
  [{ role: 'user', content: 'RULES\n\n---\n\nTEXT' }]
);
ok(
  'les règles sont bien présentes pour gemma',
  buildMessages('gemma3:4b', 'RULES', 'TEXT')[0].content.includes('RULES')
);
eq(
  'sans consigne, un seul message',
  buildMessages('gemma3:4b', '', 'TEXT'),
  [{ role: 'user', content: 'TEXT' }]
);

// ── flux SSE de DeepSeek ────────────────────────────────────
// DeepSeek streame en SSE, Ollama en NDJSON : c'est la seule vraie différence
// entre les deux fournisseurs.
eq(
  'tokens extraits de lignes data:',
  parseSseChunk(
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n' +
    'data: {"choices":[{"delta":{"content":"lo"}}]}\n'
  ).tokens,
  ['Hel', 'lo']
);
eq(
  'ligne incomplète conservée pour le prochain morceau',
  parseSseChunk('data: {"choices":[{"delta":{"content":"a"}}]}\ndata: {"cho').rest,
  'data: {"cho'
);
eq('marqueur [DONE] ignoré', parseSseChunk('data: [DONE]\n').tokens, []);
eq('lignes vides ignorées', parseSseChunk('\n\ndata: [DONE]\n').tokens, []);
eq(
  'delta sans contenu ignoré (rôle initial)',
  parseSseChunk('data: {"choices":[{"delta":{"role":"assistant"}}]}\n').tokens,
  []
);
{
  // Reconstitution d'un flux découpé arbitrairement, comme le fait le réseau.
  const full =
    'data: {"choices":[{"delta":{"content":"{\\"findings\\":"}}]}\n' +
    'data: {"choices":[{"delta":{"content":"[]}"}}]}\n' +
    'data: [DONE]\n';
  let buffer = '';
  let text = '';
  for (let i = 0; i < full.length; i += 7) {
    buffer += full.slice(i, i + 7);
    const { tokens, rest } = parseSseChunk(buffer);
    buffer = rest;
    text += tokens.join('');
  }
  eq('flux découpé recomposé correctement', text, '{"findings":[]}');
}

// ── réglages par fournisseur ────────────────────────────────
{
  const settings = {
    engine: 'deepseek',
    baseUrl: '/ollama',
    models: { ollama: 'llama3.1:8b', deepseek: 'deepseek-chat' },
  };
  eq('modèle du fournisseur actif', activeModel(settings), 'deepseek-chat');
  eq('DeepSeek passe toujours par son proxy', activeBaseUrl(settings), '/deepseek');
  eq(
    'le modèle Ollama reste mémorisé',
    activeModel({ ...settings, engine: 'ollama' }),
    'llama3.1:8b'
  );
  eq('ollama est local', isCloudProvider('ollama'), false);
  eq('deepseek est cloud', isCloudProvider('deepseek'), true);
}

// ── triage ──────────────────────────────────────────────────
let states = new Map();
states = toggleState(states, 'x', REVIEW_STATES.ACCEPTED);
eq('accepté', stateOf(states, 'x'), 'accepted');
states = toggleState(states, 'x', REVIEW_STATES.ACCEPTED);
eq('re-cliquer rouvre le finding', stateOf(states, 'x'), 'pending');
states = toggleState(states, 'x', REVIEW_STATES.REJECTED);
eq('rejeté', stateOf(states, 'x'), 'rejected');

// ── transport de la revue ───────────────────────────────────
eq(
  'un événement se relit tel quel',
  decodeEvent(encodeEvent('finding', { task: 'clarity:1', finding: { id: 'f1' } })),
  { event: 'finding', data: { task: 'clarity:1', finding: { id: 'f1' } } }
);
eq(
  'un saut de ligne dans le contenu ne casse pas la trame',
  decodeEvent(encodeEvent('error', { message: 'ligne 1\nligne 2' })).data.message,
  'ligne 1\nligne 2'
);
{
  let threw = false;
  try {
    encodeEvent('inventé', {});
  } catch {
    threw = true;
  }
  ok('un événement hors protocole est refusé', threw);
}

// ── fan-out borné ───────────────────────────────────────────
{
  const order = [];
  let inFlight = 0;
  let peak = 0;
  const tasks = [30, 10, 20, 5, 1].map((delay, index) => ({ id: `t${index}`, delay }));

  const results = [];
  for await (const outcome of runPool(
    tasks,
    async (task) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, task.delay));
      inFlight -= 1;
      order.push(task.id);
      if (task.id === 't2') throw new Error('boum');
      return task.id;
    },
    { concurrency: 2 }
  )) {
    results.push(outcome);
  }

  eq('toutes les tâches sont rendues', results.length, 5);
  ok('la concurrence est respectée', peak <= 2);
  ok(
    'une tâche en échec est rendue comme telle, sans arrêter les autres',
    results.filter((r) => r.error).length === 1 &&
      results.filter((r) => r.value).length === 4
  );
  ok('les résultats sortent dans l’ordre d’arrivée', order.indexOf('t1') < order.indexOf('t0'));
}

// ── planification ───────────────────────────────────────────
{
  const registry = [
    { id: 'clarity-tone', skills: ['clarity', 'tone'], engine: 'llm', scope: 'batch' },
    { id: 'consistency', skills: ['consistency'], engine: 'llm', scope: 'document' },
    { id: 'spelling-grammar', skills: ['spelling', 'grammar'], engine: 'languagetool', scope: 'document' },
  ];
  const plan = (skills, pageCount) =>
    planTasks({ skills, pageCount, registry });

  eq('un skill décoché ne produit aucune tâche', plan([], 10).length, 0);
  eq(
    'l’orthographe seule ne coûte aucun appel de modèle',
    plan(['spelling'], 10).filter((task) => task.engine === 'llm').length,
    0
  );
  eq('une page = une tâche pour les contrôles par lot', plan(['clarity'], 10).length, 10);
  eq(
    'un contrôle de portée document ne produit qu’une tâche',
    plan(['consistency'], 10).length,
    1
  );
  eq(
    'la répartition par moteur alimente l’estimation',
    taskCountByEngine(plan(['spelling', 'clarity', 'consistency'], 10)),
    { languagetool: 1, llm: 11 }
  );
}

// ── session ─────────────────────────────────────────────────
{
  const secret = 'mot-de-passe';
  const cookie = await issueSession(secret);
  ok('une session fraîche est valide', await verifySession(cookie, secret));
  ok('un autre secret ne passe pas', !(await verifySession(cookie, 'autre')));
  ok('une signature bricolée ne passe pas', !(await verifySession(`${Date.now() + 1000}.x`, secret)));
  ok('une session expirée ne passe pas', !(await verifySession('1.abc', secret)));
  ok('sans mot de passe configuré, l’authentification est désactivée', authDisabled({}));
}

console.log(failures === 0 ? '\n✔ tous les tests unitaires passent' : `\n✘ ${failures} test(s) en échec`);
process.exit(failures === 0 ? 0 : 1);
