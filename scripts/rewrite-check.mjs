/**
 * Vérifie la régénération sur un vrai document.
 *
 *     npm run check:rewrite -- mon-rapport.docx
 *     npm run check:rewrite -- deck.pptx
 *
 * Les tests du dépôt utilisent des fichiers d'épreuve fabriqués à la main :
 * ils reproduisent ce qu'on sait qui casse, pas ce qu'on ignore. Word, Google
 * Docs et LibreOffice découpent leurs runs différemment, et c'est précisément
 * là que ce genre de code se fissure. Ce script prend un document réel,
 * applique une correction minimale à chacune de ses premières phrases,
 * réécrit, rouvre, et vérifie que **rien d'autre** n'a bougé.
 *
 * Rien n'est envoyé nulle part : tout se passe sur cette machine.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dom = require('@xmldom/xmldom');
const JSZip = require('jszip');

const path = process.argv[2];
if (!path) {
  console.error('Usage : npm run check:rewrite -- <fichier.docx|fichier.pptx>');
  process.exit(1);
}

const kind = extname(path).toLowerCase();
const bytes = readFileSync(path);

/** Le texte du document, tel que la revue le verrait. */
const readText = async (buffer) => {
  if (kind === '.docx') {
    const mammoth = require('mammoth');
    return (await mammoth.extractRawText({ buffer })).value;
  }
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
  const parts = [];
  for (const name of slides) {
    const xml = await zip.file(name).async('string');
    parts.push([...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(''));
  }
  return parts.join('\n');
};

const { splitSentences } = await import('../src/services/textBlocks.js');
const { rewriteDocx } = await import('../src/services/rewrite/docx.js');
const { rewritePptx } = await import('../src/services/rewrite/pptx.js');

const before = await readText(bytes);
const sentences = before
  .split(/\n+/)
  .flatMap((line) => splitSentences(line.replace(/\s+/g, ' ').trim()))
  .filter((sentence) => sentence.length > 25 && /[a-zàâçéèêëîïôûùüÿñæœ]/i.test(sentence))
  .slice(0, 8);

if (!sentences.length) {
  console.error('Aucune phrase exploitable trouvée dans ce document.');
  process.exit(1);
}

// Une correction minimale et repérable : un mot du milieu doublé d'un tiret.
// Elle ne veut rien dire, et c'est le but — on mesure la mécanique, pas le
// modèle.
const MARK = '‑';
const edits = sentences.map((sentence, index) => ({
  sentenceId: `s${index}`,
  original: sentence,
  text: sentence.replace(/ ([a-zàéèêîôû]{4,}) /iu, ` $1${MARK} `),
  ids: [`f${index}`],
})).filter((edit) => edit.text !== edit.original);

console.log(`${basename(path)} — ${sentences.length} phrases lues, ${edits.length} corrections d'épreuve`);

const rewrite = kind === '.docx' ? rewriteDocx : rewritePptx;
const result = await rewrite(bytes, edits, { dom });
const output = Buffer.from(await result.blob.arrayBuffer());
const after = await readText(output);

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '✔' : '✘'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
};

check(`${result.applied.length} correction(s) appliquée(s)`, result.applied.length > 0);
check(
  `${result.notFound.length} phrase(s) introuvable(s)`,
  result.notFound.length === 0,
  result.notFound.map((entry) => entry.original.slice(0, 60)).join(' | ')
);
if (result.skipped.length) {
  console.log(`  ${result.skipped.length} écartée(s) : ${result.skipped.map((s) => s.reason).join(', ')}`);
}

// Le document rouvert, une fois les marques retirées, doit être l'original.
check(
  'le document ne change nulle part ailleurs',
  after.split(MARK).join('') === before,
  'des différences existent en dehors des corrections'
);
check('le nombre de marques correspond', after.split(MARK).length - 1 === result.applied.length);

const [zipBefore, zipAfter] = await Promise.all([JSZip.loadAsync(bytes), JSZip.loadAsync(output)]);
const names = (zip) => Object.keys(zip.files).filter((n) => !n.endsWith('/')).sort();
check('aucune partie de l’archive n’a disparu', JSON.stringify(names(zipBefore)) === JSON.stringify(names(zipAfter)));

let untouched = 0;
for (const name of names(zipBefore)) {
  const [a, b] = await Promise.all([
    zipBefore.file(name).async('string'),
    zipAfter.file(name).async('string'),
  ]);
  if (a === b) untouched += 1;
}
console.log(`  ${untouched} partie(s) sur ${names(zipBefore).length} recopiée(s) à l'identique`);

if (result.grown?.length) {
  console.log(`  texte rallongé sur la/les diapositive(s) ${result.grown.join(', ')}`);
}

if (process.argv[3]) {
  writeFileSync(process.argv[3], output);
  console.log(`  écrit : ${process.argv[3]}`);
}

console.log(failures === 0 ? '\n✔ le document survit à la régénération' : `\n✘ ${failures} vérification(s) en échec`);
process.exit(failures === 0 ? 0 : 1);
