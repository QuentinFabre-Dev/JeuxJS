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

// ── triage ──────────────────────────────────────────────────
let states = new Map();
states = toggleState(states, 'x', REVIEW_STATES.ACCEPTED);
eq('accepté', stateOf(states, 'x'), 'accepted');
states = toggleState(states, 'x', REVIEW_STATES.ACCEPTED);
eq('re-cliquer rouvre le finding', stateOf(states, 'x'), 'pending');
states = toggleState(states, 'x', REVIEW_STATES.REJECTED);
eq('rejeté', stateOf(states, 'x'), 'rejected');

console.log(failures === 0 ? '\n✔ tous les tests unitaires passent' : `\n✘ ${failures} test(s) en échec`);
process.exit(failures === 0 ? 0 : 1);
