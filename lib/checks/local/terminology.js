/**
 * Terminology and acronyms — the mechanical half of "consistency".
 *
 * A model is not needed to notice that CVSS is used on page 3 and spelled out
 * on page 7: that is a fact about character positions, not a judgement. What a
 * model *is* needed for — a claim on page 2 contradicting page 9 — stays with
 * the `consistency` check.
 *
 * Two findings are produced, and only two, because they are the only ones a
 * search can prove:
 *   - an acronym used before it is defined;
 *   - a glossary term written in a variant form.
 */

// Acronyms nobody expands in a professional document. Reporting them would
// train the reader to ignore the whole category.
const UBIQUITOUS = new Set([
  'PDF', 'HTML', 'CSS', 'URL', 'API', 'IT', 'AI', 'CEO', 'CFO', 'CTO', 'HR',
  'RGPD', 'GDPR', 'PME', 'TVA', 'SAS', 'SARL', 'EUR', 'USD', 'OK', 'FAQ',
  'ISO', 'UE', 'EU', 'USA', 'PC', 'PDG', 'RH', 'SI', 'KPI', 'ROI',
]);

const ACRONYM = /\b[A-Z][A-Z0-9]{1,6}\b/g;

/** "Common Vulnerability Scoring System (CVSS)" or "CVSS (Common …)". */
const definesAcronym = (text, acronym) =>
  new RegExp(`\\(\\s*${acronym}\\s*\\)`).test(text) ||
  new RegExp(`\\b${acronym}\\b\\s*\\(`).test(text);

/** Case- and separator-insensitive form, for comparing term variants. */
const canonical = (term) =>
  term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-'’]/g, '');

/**
 * @param {{id:string, page:number, text:string}[]} sentences  reading order
 * @param {object} [options]
 * @param {string[]} [options.glossary]  canonical business terms
 * @returns raw candidates, in the same shape the model returns
 */
export const checkTerminology = (sentences, { glossary = [] } = {}) => {
  const candidates = [];
  const firstUse = new Map();
  const defined = new Map();
  // Reading position, because ids do not sort: 'p10s1' precedes 'p3s1'.
  const position = new Map(sentences.map((sentence, index) => [sentence.id, index]));

  for (const sentence of sentences) {
    for (const acronym of sentence.text.match(ACRONYM) ?? []) {
      if (UBIQUITOUS.has(acronym)) continue;
      if (definesAcronym(sentence.text, acronym)) {
        if (!defined.has(acronym)) defined.set(acronym, sentence);
      } else if (!firstUse.has(acronym)) {
        firstUse.set(acronym, sentence);
      }
    }
  }

  for (const [acronym, use] of firstUse) {
    const definition = defined.get(acronym);
    // No definition anywhere is a judgement call — some acronyms are house
    // language. A definition that arrives *after* the first use is a fact.
    if (!definition) continue;
    if (position.get(definition.id) <= position.get(use.id)) continue;

    candidates.push({
      id: use.id,
      skill: 'consistency',
      suggestion: use.text,
      explanation: `« ${acronym} » est employé ici alors qu'il n'est défini qu'en page ${definition.page}. Définissez-le à sa première occurrence.`,
      priority: 'low',
      confidence: 0.9,
    });
  }

  // Glossary variants: the canonical form is the one the pack declares.
  const canonicalTerms = new Map(glossary.map((term) => [canonical(term), term]));
  for (const sentence of sentences) {
    for (const word of sentence.text.match(/[\p{L}][\p{L}\-'’]{2,}/gu) ?? []) {
      const expected = canonicalTerms.get(canonical(word));
      if (!expected || expected === word) continue;
      candidates.push({
        id: sentence.id,
        skill: 'consistency',
        suggestion: sentence.text.replace(word, expected),
        explanation: `Le glossaire retient « ${expected} » ; ce passage écrit « ${word} ».`,
        priority: 'low',
        confidence: 0.95,
      });
    }
  }

  return candidates;
};
