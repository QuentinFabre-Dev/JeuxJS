/**
 * Aller-retour PowerPoint : fabriquer un .pptx, le corriger, le rouvrir.
 *
 * Même exigence que pour Word — un deck peut ressortir avec le bon texte et
 * une présentation cassée —, plus le piège propre au format : PowerPoint ne
 * reflue pas, donc une correction plus longue peut déborder de sa zone. Le
 * test vérifie que les diapositives concernées sont nommées.
 *
 * Le fichier d'épreuve reproduit ce qui casse : une phrase éclatée sur
 * plusieurs runs, une couleur portée par le run corrigé, et des notes.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dom = require('@xmldom/xmldom');
const JSZip = require('jszip');

const { rewritePptx } = await import('../src/services/rewrite/pptx.js');

let failures = 0;
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${label}${ok ? '' : ` — attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`}`);
};
const ok = (label, value) => eq(label, !!value, true);

const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const shape = (name, paragraphs) => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="838200" y="365125"/><a:ext cx="7772400" cy="1325563"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;

const slide = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${P} ${A}><p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
${body}</p:spTree></p:cSld></p:sld>`;

const buildPptx = async () => {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`
  );
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );
  zip.folder('ppt').file(
    'presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation ${P}><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`
  );

  // « recomandons » coupé en deux runs, le second portant une couleur.
  zip.folder('ppt/slides').file(
    'slide1.xml',
    slide(
      shape(
        'Titre 1',
        `<a:p><a:r><a:t>Recommandations</a:t></a:r></a:p>`
      ) +
        shape(
          'Contenu 2',
          `<a:p>
  <a:r><a:t xml:space="preserve">Nous </a:t></a:r>
  <a:r><a:rPr lang="fr-FR"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:rPr><a:t>recomand</a:t></a:r>
  <a:r><a:rPr lang="fr-FR"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:rPr><a:t>ons</a:t></a:r>
  <a:r><a:t xml:space="preserve"> le MFA.</a:t></a:r>
</a:p>`
        )
    )
  );
  zip.folder('ppt/slides').file(
    'slide2.xml',
    slide(shape('Contenu 1', `<a:p><a:r><a:t>Cette diapositive ne doit pas bouger.</a:t></a:r></a:p>`))
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const textOf = async (zip, part) =>
  [...(await zip.file(part).async('string')).matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
    .map((match) => match[1])
    .join('');

const source = await buildPptx();
const result = await rewritePptx(
  source,
  [
    {
      sentenceId: 'p1s2',
      original: 'Nous recomandons le MFA.',
      text: 'Nous recommandons le MFA sur tous les comptes à privilèges.',
      ids: ['f1'],
    },
    {
      sentenceId: 'ghost',
      original: 'Une phrase absente du deck.',
      text: 'Peu importe.',
      ids: ['f9'],
    },
  ],
  { dom }
);

const buffer = Buffer.from(await result.blob.arrayBuffer());
const zip = await JSZip.loadAsync(buffer);
const slide1 = await zip.file('ppt/slides/slide1.xml').async('string');

console.log('\n── aller-retour PowerPoint ─────────────────────────────────');

eq('la correction est appliquée', result.applied, ['f1']);
eq('la phrase absente est signalée', result.notFound.map((e) => e.sentenceId), ['ghost']);
eq('aucune correction écartée', result.skipped, []);

eq(
  'le texte de la diapositive est corrigé',
  await textOf(zip, 'ppt/slides/slide1.xml'),
  'RecommandationsNous recommandons le MFA sur tous les comptes à privilèges.'
);
ok('la couleur du run corrigé survit', slide1.includes('C00000'));
ok('la géométrie de la forme est intacte', slide1.includes('<a:ext cx="7772400" cy="1325563"/>'));
ok('les noms de formes sont intacts', slide1.includes('name="Titre 1"') && slide1.includes('name="Contenu 2"'));

eq(
  'la diapositive rallongée est nommée : PowerPoint ne reflue pas',
  result.grown,
  [1]
);
eq(
  'la diapositive non touchée est identique au caractère près',
  await textOf(zip, 'ppt/slides/slide2.xml'),
  'Cette diapositive ne doit pas bouger.'
);
eq(
  'aucune partie de l’archive n’a disparu',
  Object.keys(zip.files).filter((n) => !n.endsWith('/')).sort(),
  ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml']
);

// Une correction qui raccourcit le texte ne doit alerter personne.
const shorter = await rewritePptx(
  source,
  [{ sentenceId: 'p1s2', original: 'Nous recomandons le MFA.', text: 'Nous recommandons.', ids: ['f2'] }],
  { dom }
);
eq('une correction plus courte n’alerte pas', shorter.grown, []);

console.log(failures === 0 ? '\n✔ aller-retour PowerPoint : tout passe' : `\n✘ ${failures} test(s) en échec`);
process.exit(failures === 0 ? 0 : 1);
