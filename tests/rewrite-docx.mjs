/**
 * Aller-retour Word : fabriquer un .docx, le corriger, le rouvrir.
 *
 * Le test le plus utile de cette fonctionnalité n'est pas unitaire. Un
 * document Word peut ressortir avec le bon texte et une mise en forme
 * détruite, ou pire, illisible par Word — et seule la réouverture le dit.
 * Le fichier d'épreuve reproduit ce qui casse en vrai : une phrase éclatée
 * sur plusieurs runs, du gras au milieu d'un mot corrigé, un style de titre,
 * et du texte en en-tête.
 *
 * `npm test` l'exécute avec les tests unitaires.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dom = require('@xmldom/xmldom');
const mammoth = require('mammoth');
const JSZip = require('jszip');

const { rewriteDocx } = await import('../src/services/rewrite/docx.js');

let failures = 0;
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${label}${ok ? '' : ` — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`}`);
};
const ok = (label, value) => eq(label, !!value, true);

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const buildDocx = async () => {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder('word/_rels').file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );
  // « recomandons » est coupé en deux runs, tous deux en gras : c'est ce que
  // Word produit après un passage du correcteur.
  zip.folder('word').file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>1. Recommandations</w:t></w:r></w:p>
<w:p>
  <w:r><w:t xml:space="preserve">Nous </w:t></w:r>
  <w:r><w:rPr><w:b/></w:rPr><w:t>recomand</w:t></w:r>
  <w:r><w:rPr><w:b/></w:rPr><w:t>ons</w:t></w:r>
  <w:r><w:t xml:space="preserve"> la mise en place du </w:t></w:r>
  <w:r><w:rPr><w:i/></w:rPr><w:t>MFA</w:t></w:r>
  <w:r><w:t xml:space="preserve"> sur les comptes.</w:t></w:r>
</w:p>
<w:p><w:r><w:t>Les tests a été réalisés en mars.</w:t></w:r></w:p>
<w:p><w:r><w:t>Cette phrase ne doit pas bouger d'un caractère.</w:t></w:r></w:p>
<w:sectPr><w:headerReference w:type="default" r:id="rId1" ${R}/></w:sectPr>
</w:body></w:document>`
  );
  zip.folder('word').file(
    'header1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${W}><w:p><w:r><w:t>Confidentiel — Northwind Industries</w:t></w:r></w:p></w:hdr>`
  );
  zip.folder('word').file(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style></w:styles>`
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const source = await buildDocx();
const before = await mammoth.extractRawText({ buffer: source });

const result = await rewriteDocx(
  source,
  [
    {
      sentenceId: 'p1s2',
      original: 'Nous recomandons la mise en place du MFA sur les comptes.',
      text: 'Nous recommandons la mise en place du MFA sur les comptes.',
      ids: ['f1'],
    },
    {
      sentenceId: 'p1s3',
      original: 'Les tests a été réalisés en mars.',
      text: 'Les tests ont été réalisés en mars.',
      ids: ['f2'],
    },
    {
      sentenceId: 'h1',
      original: 'Confidentiel — Northwind Industries',
      text: 'Confidentiel — Northwind Group',
      ids: ['f3'],
    },
    {
      sentenceId: 'ghost',
      original: 'Une phrase qui ne figure pas dans le fichier.',
      text: 'Peu importe.',
      ids: ['f9'],
    },
  ],
  { dom }
);

const buffer = Buffer.from(await result.blob.arrayBuffer());
const after = await mammoth.extractRawText({ buffer });
const zip = await JSZip.loadAsync(buffer);
const document = await zip.file('word/document.xml').async('string');

console.log('\n── aller-retour Word ───────────────────────────────────────');

eq('les trois corrections trouvées sont appliquées', result.applied, ['f1', 'f2', 'f3']);
eq('celle qui n’est pas dans le fichier est signalée', result.notFound.map((e) => e.sentenceId), ['ghost']);
eq('aucune correction écartée', result.skipped, []);

ok('la faute d’orthographe est corrigée', after.value.includes('Nous recommandons'));
ok('l’accord aussi', after.value.includes('Les tests ont été réalisés'));
ok('deux corrections successives ne se décalent pas', !after.value.includes('testsonta'));
ok('le texte en en-tête est corrigé', (await zip.file('word/header1.xml').async('string')).includes('Northwind Group'));

ok('le gras au milieu du mot corrigé survit', document.includes('<w:b/>'));
ok('l’italique d’un autre mot de la phrase aussi', document.includes('<w:i/>'));
ok('le style de titre est intact', document.includes('Heading1'));
ok('la feuille de styles n’a pas été touchée', (await zip.file('word/styles.xml').async('string')).includes('heading 1'));

eq(
  'aucune partie de l’archive n’a disparu',
  Object.keys(zip.files).filter((n) => !n.endsWith('/')).sort(),
  ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/header1.xml', 'word/styles.xml']
);

ok(
  'la phrase que personne n’a corrigée est identique au caractère près',
  after.value.includes("Cette phrase ne doit pas bouger d'un caractère.")
);
eq(
  'et le document ne change nulle part ailleurs',
  after.value
    .replace('Nous recommandons', 'Nous recomandons')
    .replace('Les tests ont été', 'Les tests a été'),
  before.value
);

console.log(failures === 0 ? '\n✔ aller-retour Word : tout passe' : `\n✘ ${failures} test(s) en échec`);
process.exit(failures === 0 ? 0 : 1);
