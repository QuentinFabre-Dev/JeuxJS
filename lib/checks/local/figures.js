/**
 * Figures, units and dates — the other mechanical half of "consistency".
 *
 * Knowing that two numbers *ought* to be equal is not always mechanical, so
 * this check does not try. It reports only what a comparison can prove, and
 * hands everything ambiguous to the model. A deterministic check that bluffs
 * is worse than no check at all.
 *
 * Three findings:
 *   - the same amount written two different ways (4,2 M€ / 4.2M€);
 *   - two dates in two different formats;
 *   - the same label carrying two different values.
 */

const AMOUNT =
  /(\d[\d\s  .,]*)\s*(k€|M€|Md€|k\$|M\$|%|€|\$|£)/gi;

const DATE_FORMATS = [
  { id: 'numeric', pattern: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, label: 'numérique (12/03/2025)' },
  { id: 'iso', pattern: /\b\d{4}-\d{2}-\d{2}\b/g, label: 'ISO (2025-03-12)' },
  {
    id: 'written',
    pattern:
      /\b\d{1,2}(?:er)?\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    label: 'en toutes lettres (12 mars 2025)',
  },
];

/** 4,2 / 4.2 / 4 200 → a comparable number. */
const numeric = (raw) => {
  const cleaned = String(raw).replace(/[\s  ]/g, '').replace(',', '.');
  // A thousands separator written as a dot ("4.200") is not a decimal point:
  // three trailing digits with no other dot means grouping.
  const value = Number(/^\d+\.\d{3}$/.test(cleaned) ? cleaned.replace('.', '') : cleaned);
  return Number.isFinite(value) ? value : null;
};

const unitKey = (unit) => unit.toLowerCase().replace('md', 'm');

/** The words immediately before a figure, used as its label. */
const labelBefore = (text, index) => {
  const words = text.slice(0, index).trim().split(/\s+/).slice(-4);
  return words.join(' ').toLowerCase().replace(/[«»"'(:,]/g, '').trim();
};

export const checkFigures = (sentences) => {
  const candidates = [];
  const amounts = new Map(); // value+unit → first spelling seen
  const labels = new Map(); // label+unit → first value seen
  const dateFormats = new Map(); // format id → first sentence using it

  for (const sentence of sentences) {
    for (const match of sentence.text.matchAll(AMOUNT)) {
      const [whole, rawValue, unit] = match;
      const value = numeric(rawValue);
      if (value === null) continue;

      const spelling = whole.trim();
      const key = `${value}::${unitKey(unit)}`;
      const seen = amounts.get(key);
      if (!seen) {
        amounts.set(key, { spelling, sentence });
      } else if (seen.spelling !== spelling) {
        candidates.push({
          id: sentence.id,
          skill: 'consistency',
          suggestion: sentence.text.replace(spelling, seen.spelling),
          explanation: `Le même montant est écrit « ${seen.spelling} » en page ${seen.sentence.page} et « ${spelling} » ici. Gardez une seule écriture.`,
          priority: 'low',
          confidence: 0.85,
        });
      }

      // Same label, different value: reported only when the labels are
      // identical strings, which keeps this precise rather than plausible.
      const label = labelBefore(sentence.text, match.index);
      if (label.length >= 6) {
        const labelKey = `${label}::${unitKey(unit)}`;
        const previous = labels.get(labelKey);
        if (!previous) {
          labels.set(labelKey, { value, spelling, sentence });
        } else if (previous.value !== value) {
          candidates.push({
            id: sentence.id,
            skill: 'consistency',
            suggestion: sentence.text,
            explanation: `« ${label} » vaut ${previous.spelling} en page ${previous.sentence.page} et ${spelling} ici. Vérifiez lequel fait foi.`,
            priority: 'high',
            confidence: 0.8,
          });
        }
      }
    }

    for (const format of DATE_FORMATS) {
      if (!format.pattern.test(sentence.text)) continue;
      format.pattern.lastIndex = 0;
      if (!dateFormats.has(format.id)) dateFormats.set(format.id, { format, sentence });
    }
  }

  if (dateFormats.size > 1) {
    const [first, ...others] = [...dateFormats.values()];
    for (const other of others) {
      candidates.push({
        id: other.sentence.id,
        skill: 'consistency',
        suggestion: other.sentence.text,
        explanation: `Le document mélange les formats de date : ${first.format.label} en page ${first.sentence.page}, ${other.format.label} ici.`,
        priority: 'low',
        confidence: 0.9,
      });
    }
  }

  return candidates;
};
