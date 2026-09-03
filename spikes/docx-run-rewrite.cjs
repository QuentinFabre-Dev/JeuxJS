/**
 * Spike du plan « régénérer le document corrigé » (docs/plan-document-corrige.md).
 *
 * Mesure ce qu'il en coûte de corriger une phrase éclatée sur plusieurs runs
 * Word : réécrire la phrase entière touche 4 runs sur 5 et perd le formatage
 * interne ; rogner d'abord le préfixe et le suffixe communs n'en touche qu'un
 * et conserve gras et italique.
 *
 *     node spikes/docx-run-rewrite.cjs
 *
 * Gardé dans le dépôt parce que c'est la mesure sur laquelle repose le choix
 * d'implémentation, et qu'elle doit pouvoir être rejouée.
 */
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// « recomandons » en gras au milieu de la phrase : le cas qui fait mal.
const PARA = `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:r><w:t xml:space="preserve">Nous </w:t></w:r>
  <w:r><w:rPr><w:b/></w:rPr><w:t>recomandons</w:t></w:r>
  <w:r><w:t xml:space="preserve"> la mise en place du </w:t></w:r>
  <w:r><w:rPr><w:i/></w:rPr><w:t>MFA</w:t></w:r>
  <w:r><w:t>.</w:t></w:r>
</w:p>`;

const original  = 'Nous recomandons la mise en place du MFA.';
const corrected = 'Nous recommandons la mise en place du MFA.';

// Ne réécrire que ce qui change : on rogne le préfixe et le suffixe communs.
const trim = (a, b) => {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let end = 0;
  while (
    end < a.length - start && end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  ) end += 1;
  return { start, aEnd: a.length - end, replacement: b.slice(start, b.length - end) };
};

const span = trim(original, corrected);
console.log('portion réellement modifiée :', JSON.stringify(original.slice(span.start, span.aEnd)),
            '→', JSON.stringify(span.replacement));

const doc = new DOMParser().parseFromString(PARA, 'text/xml');
const nodes = Array.from(doc.getElementsByTagName('w:t'));
let cursor = 0;
const map = nodes.map((node) => {
  const start = cursor; cursor += node.textContent.length;
  return { node, start, end: cursor };
});
const paragraph = map.map((m) => m.node.textContent).join('');

const base = paragraph.indexOf(original);
const from = base + span.start;
const to = base + span.aEnd;
const covered = map.filter((m) => m.end > from && m.start < to);
console.log(`runs touchés : ${covered.length} sur ${map.length}`);

covered.forEach((m, i) => {
  const head = m.node.textContent.slice(0, Math.max(0, from - m.start));
  const tail = m.node.textContent.slice(Math.max(0, to - m.start));
  m.node.textContent = i === 0 ? head + span.replacement + (covered.length === 1 ? tail : '') : tail;
});

const out = new XMLSerializer().serializeToString(doc);
const after = Array.from(new DOMParser().parseFromString(out, 'text/xml')
  .getElementsByTagName('w:t')).map((n) => n.textContent).join('');
console.log('résultat :', JSON.stringify(after));
console.log('gras conservé  :', out.includes('<w:b/>'));
console.log('italique conservé :', out.includes('<w:i/>'));
