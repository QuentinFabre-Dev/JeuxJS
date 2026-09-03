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
import { encodeEvent, decodeEvent, splitFrames } from '../lib/sse.js';
import { runPool } from '../lib/checks/pool.js';
import { planTasks, taskCountByEngine } from '../lib/checks/planner.js';
import { estimateReview, formatCost, formatDuration } from '../lib/checks/estimate.js';
import { checksForSkills } from '../lib/checks/registry.js';
import { runLocalChecks, splitRequirements } from '../lib/checks/local/index.js';
import { actualCost } from '../lib/checks/estimate.js';
import { render, formatSentences } from '../lib/checks/prompt.js';
import { buildRequest, sentencesForTask } from '../lib/checks/runner.js';
import { checkById } from '../lib/checks/registry.js';
import { documentSentences, forTransport, consistencyCandidates } from '../lib/checks/sentences.js';
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

// ── découpage du flux ───────────────────────────────────────
{
  const stream = `${encodeEvent('plan', { tasks: [] })}${encodeEvent('finding', { task: 'a' })}`;
  const cut = 30;
  const first = splitFrames(stream.slice(0, cut));
  const second = splitFrames(first.rest + stream.slice(cut));
  eq(
    'une trame coupée par une frontière de chunk n’est pas perdue',
    [...first.frames, ...second.frames].map((frame) => decodeEvent(frame).event),
    ['plan', 'finding']
  );
  eq('le fragment incomplet est rendu au flux', splitFrames('event: x\ndata:').frames, []);
}

// ── estimation avant lancement ──────────────────────────────
{
  const estimateFor = (skills) => estimateReview(planTasks({ skills, pageCount: 10 }));
  const cents = (skills) => Math.round(estimateFor(skills).dollars * 100);

  eq('rien de sélectionné, rien à payer', cents([]), 0);
  eq('orthographe + grammaire : 1 centime sur 10 pages', cents(['spelling', 'grammar']), 1);
  eq('clarté + ton : 6 centimes', cents(['clarity', 'tone']), 6);
  eq(
    'revue complète : 14 centimes',
    cents(['spelling', 'grammar', 'clarity', 'tone', 'consistency', 'custom']),
    14
  );
  ok(
    'la passe mécanique est cinq fois moins chère que le jugement rédactionnel',
    cents(['clarity', 'tone']) / cents(['spelling', 'grammar']) > 4
  );
  ok(
    'la revue complète tient sous 25 secondes',
    estimateFor(['spelling', 'grammar', 'clarity', 'tone', 'consistency', 'custom']).seconds < 25
  );
  eq(
    'les contrôles déterministes ne coûtent rien et ne rallongent rien',
    (() => {
      const local = estimateReview(
        planTasks({ skills: ['consistency'], pageCount: 10 }).filter((task) =>
          ['terminology', 'figures'].includes(task.check)
        )
      );
      return [local.dollars, local.calls, local.free];
    })(),
    [0, 0, 2]
  );
  eq('une sélection vide ne retient aucun contrôle', checksForSkills([]).length, 0);
  eq('la durée se lit en une phrase', [formatDuration(0.4), formatDuration(20), formatDuration(200)], ['< 1 s', '≈ 20 s', '≈ 3 min']);
  eq('le coût aussi', [formatCost(0), formatCost(0.004), formatCost(0.42)], ['free', '< $0.01', '≈ $0.42']);
}

// ── contrôles déterministes ─────────────────────────────────
{
  const s = (id, page, text) => ({ id, page, text });
  const doc = [
    s('p1s1', 1, "Le rapport Acme Corp couvre l'exercice."),
    s('p2s1', 2, 'Le score CVSS retenu est de 7,5.'),
    s('p2s2', 2, "Le chiffre d'affaires atteint 4,2 M€ sur la période."),
    s('p3s1', 3, "Livré le 12/03/2025 par l'équipe, au format PDF."),
    s('p7s1', 7, 'Le Common Vulnerability Scoring System (CVSS) sert de référence.'),
    s('p8s1', 8, "Le chiffre d'affaires atteint 4.2M€ selon l'annexe."),
    s('p9s1', 9, 'Validé le 3 avril 2025 en comité.'),
    s('p9s2', 9, 'Une remarque sur Acme Corp figure ici.'),
    s('p9s3', 9, 'Nous employons la cybersécurité comme cadre.'),
  ];
  const run = (ids, context) => runLocalChecks(ids, doc, context);
  const explains = (found, fragment) =>
    found.some((candidate) => candidate.explanation.includes(fragment));

  const terms = run(['terminology'], { glossary: ['Cyber Sécurité'] });
  ok('un acronyme défini après son premier emploi est signalé', explains(terms, 'CVSS'));
  eq(
    'il est signalé à sa première occurrence, pas à sa définition',
    terms.find((candidate) => candidate.explanation.includes('CVSS')).id,
    'p2s1'
  );
  ok('un acronyme que personne n’explicite jamais n’est pas signalé', !explains(terms, 'SOC'));
  ok('un acronyme universel non plus', !explains(terms, 'PDF'));
  ok('une variante d’un terme du glossaire est signalée', explains(terms, 'Cyber Sécurité'));

  const figures = run(['figures']);
  ok('deux écritures du même montant sont signalées', explains(figures, '4.2M€'));
  ok('deux formats de date aussi', explains(figures, 'formats de date'));
  eq(
    'le document de référence, lui, ne déclenche rien',
    runLocalChecks(['terminology', 'figures'], [s('p1s1', 1, 'Une phrase parfaitement neutre.')]).length,
    0
  );

  const patterns = run(['patterns'], {
    requirements: ['aucun nom de client hors page de garde : "Acme Corp"'],
  });
  eq('un terme cité est cherché, la page de garde exemptée', patterns.map((c) => c.id), ['p9s2']);
  eq('une exigence sans guillemets n’est pas traitée en local', run(['patterns'], { requirements: ['les conclusions avant leur justification'] }).length, 0);
  eq(
    'et elle part au modèle',
    splitRequirements(['pas de "Acme"', 'conclusions avant justification']),
    { pattern: ['pas de "Acme"'], semantic: ['conclusions avant justification'] }
  );

  // Le choix de ne pas utiliser de worker repose sur cette mesure.
  const big = [];
  for (let page = 1; page <= 200; page += 1) {
    for (let i = 1; i <= 12; i += 1) {
      big.push(s(`p${page}s${i}`, page, `La ligne ${i} vaut ${page * 100},5 M€ selon le SOC du 0${(i % 9) + 1}/03/2025.`));
    }
  }
  const started = performance.now();
  runLocalChecks(['terminology', 'figures', 'patterns'], big, { requirements: ['pas de "Acme"'] });
  const elapsed = performance.now() - started;
  ok(`200 pages passent sous 250 ms (${elapsed.toFixed(0)} ms)`, elapsed < 250);
}

// ── document → phrases ──────────────────────────────────────
{
  const documentModel = {
    pages: [
      [
        { kind: 'heading', text: 'Synthèse' },
        { kind: 'p', text: 'Première phrase.', rects: [{ x: 1 }] },
      ],
      [{ kind: 'p', text: 'Deuxième phrase, page 2.' }],
    ],
  };

  eq(
    'les ids suivent la position dans la page, titres compris',
    documentSentences(documentModel).map((sentence) => sentence.id),
    ['p1s2', 'p2s1']
  );
  ok(
    'les rectangles ne partent pas au serveur : aucun prompt ne les lit',
    !JSON.stringify(forTransport(documentModel)).includes('rects')
  );
  eq(
    'les phrases porteuses de faits passent en tête des candidats de cohérence',
    consistencyCandidates(
      [
        { id: 'p1s1', page: 1, text: 'Une phrase sans rien de vérifiable.' },
        { id: 'p2s1', page: 2, text: 'Le montant est de 4,2 M€.' },
      ],
      1
    ).map((sentence) => sentence.id),
    ['p2s1']
  );
}

// ── prompts et requêtes ─────────────────────────────────────
{
  eq(
    'un gabarit substitue ses variables',
    render('Type: {{docType}}\n{{sentences}}', { docType: 'report', sentences: 'p1s1: Bonjour.' }),
    'Type: report\np1s1: Bonjour.'
  );
  eq(
    'une variable absente disparaît au lieu de rester visible',
    render('a{{inconnue}}b', {}),
    'ab'
  );
  eq(
    'les phrases sont numérotées comme le modèle doit répondre',
    formatSentences([{ id: 'p1s1', text: 'Une phrase.' }]),
    'p1s1: Une phrase.'
  );

  const sentences = [
    { id: 'p1s1', page: 1, text: 'Phrase de la page une.' },
    { id: 'p2s1', page: 2, text: 'Phrase de la page deux.' },
  ];
  eq(
    'une tâche de lot ne voit que ses pages',
    sentencesForTask({ scope: 'batch', pages: [2] }, sentences).map((s) => s.id),
    ['p2s1']
  );
  eq(
    'une tâche de portée document les voit toutes',
    sentencesForTask({ scope: 'document' }, sentences).length,
    2
  );

  const documentModel = { pages: [[{ kind: 'p', text: 'Phrase de la page une.' }]] };
  const context = { docType: 'report', serviceLine: 'audit', language: 'français' };
  const main = buildRequest(checkById('clarity-tone'), { sentences, documentModel, context });
  const fast = buildRequest(checkById('mechanical'), { sentences, documentModel, context });

  eq('le jugement rédactionnel part sur le palier raisonnement', main.model, 'gpt-5');
  eq('la passe mécanique part sur le petit palier', fast.model, 'gpt-5-mini');
  eq(
    'le raisonnement est bridé : ses jetons sont facturés en sortie',
    [main.reasoning.effort, fast.reasoning.effort],
    ['minimal', 'minimal']
  );
  eq('la sortie est contrainte par le schéma', main.text.format.type, 'json_schema');
  ok('en mode strict', main.text.format.strict === true);
  ok(
    'le schéma strict exige toutes ses propriétés',
    main.text.format.schema.properties.findings.items.required.includes('custom_label')
  );
  ok(
    'les instructions sont identiques d’un contrôle à l’autre, donc cachables',
    main.instructions === fast.instructions
  );
  ok('les phrases arrivent numérotées dans le prompt', main.input.includes('p2s1: Phrase de la page deux.'));
  ok('la langue du document est transmise', main.input.includes('français'));
  ok('la sortie est plafonnée', main.max_output_tokens <= 4096);
}

// ── facture réelle ──────────────────────────────────────────
{
  const bill = actualCost({
    main: { inputTokens: 20000, outputTokens: 5000, cachedInputTokens: 10000 },
    fast: { inputTokens: 12500, outputTokens: 4000, cachedInputTokens: 0 },
  });
  // GPT-5 : 10k frais à 1,25 $/M + 10k cachés à 0,125 $/M + 5k sortis à 10 $/M
  // GPT-5 mini : 12,5k à 0,25 $/M + 4k à 2 $/M
  eq(
    'la facture distingue les paliers et le cache',
    Number(bill.dollars.toFixed(4)),
    Number((0.0125 + 0.00125 + 0.05 + 0.003125 + 0.008).toFixed(4))
  );
  eq('rien à facturer sans consommation', actualCost({}).dollars, 0);
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
