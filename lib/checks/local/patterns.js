/**
 * Client requirements a search can settle.
 *
 * A custom check is free text, and guessing which ones a regular expression
 * can decide would mean guessing wrong. So the user says it explicitly: a
 * **quoted term** is a term to look for, everything else needs judgement and
 * goes to the model.
 *
 *   no "Acme Corp" outside the cover page   → a search, free, instant
 *   conclusions must precede their evidence → the model
 *
 * The convention is visible in the input placeholder, and it costs the user
 * one pair of quotes to turn a paying check into a free one.
 */

const QUOTED = /["“”«»']\s*([^"“”«»']{2,60}?)\s*["“”«»']/g;

/** The quoted terms in a requirement, or none if it has no quotes. */
export const quotedTerms = (requirement) =>
  [...String(requirement).matchAll(QUOTED)].map((match) => match[1].trim()).filter(Boolean);

/** True when this requirement is decided by a search rather than by judgement. */
export const isPatternRequirement = (requirement) => quotedTerms(requirement).length > 0;

/**
 * @param {{id:string, page:number, text:string}[]} sentences
 * @param {object} [options]
 * @param {string[]} [options.requirements]  the user's custom checks
 * @param {number[]} [options.exemptPages]   pages the term is allowed on
 */
export const checkPatterns = (sentences, { requirements = [], exemptPages = [1] } = {}) => {
  const candidates = [];

  for (const requirement of requirements) {
    const terms = quotedTerms(requirement);
    if (!terms.length) continue;

    for (const term of terms) {
      const needle = term.toLowerCase();
      for (const sentence of sentences) {
        if (exemptPages.includes(sentence.page)) continue;
        if (!sentence.text.toLowerCase().includes(needle)) continue;

        candidates.push({
          id: sentence.id,
          skill: 'custom',
          custom_label: requirement,
          // Removing the term outright is rarely the right edit, so the
          // suggestion keeps the sentence and the explanation carries the ask.
          suggestion: sentence.text,
          explanation: `« ${term} » apparaît ici, alors que l'exigence demande : ${requirement}`,
          priority: 'high',
          confidence: 0.95,
        });
      }
    }
  }

  return candidates;
};
