/**
 * Lightweight language detection based on stop-word frequency.
 *
 * The point is not linguistic accuracy but telling the model which language it
 * is reviewing: an English prompt on a French document produces English
 * explanations and Anglo-centric style advice.
 */

const STOP_WORDS = {
  fr: ['le', 'la', 'les', 'des', 'une', 'dans', 'pour', 'que', 'qui', 'est', 'sont', 'nous', 'avec', 'sur', 'plus', 'cette', 'aux', 'par', 'ont', 'être'],
  en: ['the', 'and', 'of', 'to', 'in', 'that', 'is', 'are', 'for', 'with', 'this', 'have', 'has', 'was', 'were', 'from', 'they', 'been', 'will', 'which'],
  es: ['el', 'la', 'los', 'las', 'de', 'que', 'en', 'por', 'con', 'para', 'una', 'del', 'es', 'son', 'como', 'más', 'este', 'esta', 'se', 'ha'],
  de: ['der', 'die', 'das', 'und', 'ist', 'sind', 'den', 'von', 'mit', 'für', 'auf', 'nicht', 'ein', 'eine', 'dem', 'des', 'werden', 'wurde', 'auch', 'zum'],
  it: ['il', 'lo', 'la', 'le', 'di', 'che', 'per', 'con', 'del', 'della', 'sono', 'una', 'nel', 'alla', 'più', 'come', 'anche', 'questo', 'questa', 'gli'],
};

export const LANGUAGES = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'fr', label: 'French' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'de', label: 'German' },
  { id: 'it', label: 'Italian' },
];

export const languageLabel = (id) =>
  LANGUAGES.find((language) => language.id === id)?.label ?? id;

/**
 * @returns {{ id: string, confidence: number }} `id` is a language code, or
 * 'en' when the sample is too short to decide.
 */
export const detectLanguage = (text) => {
  const words = String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 20) return { id: 'en', confidence: 0 };

  const sample = words.slice(0, 2000);
  const scores = Object.entries(STOP_WORDS).map(([id, stopWords]) => {
    const set = new Set(stopWords);
    const hits = sample.filter((word) => set.has(word)).length;
    return { id, score: hits / sample.length };
  });

  scores.sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (best.score === 0) return { id: 'en', confidence: 0 };

  // Confidence = how far ahead the winner is from the runner-up.
  const confidence = Math.min(1, (best.score - (second?.score ?? 0)) / best.score);
  return { id: best.id, confidence: Number(confidence.toFixed(2)) };
};

/** Flattens a parsed document into a text sample for detection. */
export const documentSample = (documentModel) =>
  documentModel.pages
    .flat()
    .map((block) => block.text)
    .join(' ')
    .slice(0, 8000);
