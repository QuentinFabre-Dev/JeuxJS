import { MOCK_FINDINGS_POOL } from '../data/mockFindings.js';

/**
 * Génère un identifiant unique simple.
 */
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Mélange un tableau (Fisher-Yates).
 */
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Petit jitter aléatoire sur le score de confiance pour
 * que deux runs ne donnent pas exactement les mêmes résultats.
 */
const jitterConfidence = (base) => {
  const delta = (Math.random() - 0.5) * 0.06;
  return Math.max(0.55, Math.min(0.99, base + delta));
};

/**
 * Sélectionne les findings à émettre en fonction des skills choisis
 * et du type de document. Le type de document influence légèrement
 * le nombre et la priorité (ex : un email professionnel a plus de
 * findings de "ton").
 */
const buildRunPlan = ({ skills, docType }) => {
  const filtered = MOCK_FINDINGS_POOL.filter((f) => skills.includes(f.skill));

  // Boost contextuel : si docType = email, on duplique légèrement les findings de ton.
  let plan = [...filtered];
  if (docType === 'email') {
    plan = plan.concat(filtered.filter((f) => f.skill === 'tone'));
  }
  if (docType === 'procedure') {
    plan = plan.concat(filtered.filter((f) => f.skill === 'consistency'));
  }
  if (docType === 'policy') {
    plan = plan.concat(filtered.filter((f) => f.skill === 'clarity'));
  }

  return shuffle(plan).map((f) => ({
    ...f,
    id: uid(),
    confidence: Number(jitterConfidence(f.confidence).toFixed(2)),
  }));
};

/**
 * Service principal : simule un appel d'analyse "streaming".
 *
 * @param {Object}   options
 * @param {Object}   options.file        Fichier uploadé (mocké)
 * @param {string[]} options.skills      Liste d'identifiants de skills
 * @param {string}   options.docType     Identifiant du type de document
 * @param {Function} options.onFinding   Callback à chaque finding émis
 * @param {Function} options.onProgress  Callback de progression (0..1)
 * @param {Function} options.onComplete  Callback de fin (résumé)
 * @param {AbortSignal} [options.signal] Pour annuler l'analyse
 *
 * @returns {Promise<void>}
 */
export const runMockAnalysis = ({
  file,
  skills,
  docType,
  onFinding,
  onProgress,
  onComplete,
  signal,
}) => {
  return new Promise((resolve) => {
    const findings = buildRunPlan({ skills, docType });
    const total = findings.length;
    let index = 0;

    if (total === 0) {
      onProgress?.(1);
      onComplete?.({ findings: [], score: 100 });
      resolve();
      return;
    }

    // Petit délai initial pour simuler "préparation du modèle"
    const initialDelay = 600;

    const emitNext = () => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      if (index >= total) {
        const score = computeDocumentScore(findings);
        onProgress?.(1);
        onComplete?.({ findings, score });
        resolve();
        return;
      }

      const finding = findings[index];
      onFinding?.(finding);
      index += 1;
      onProgress?.(index / total);

      // Délai aléatoire entre 250 et 850 ms entre 2 findings
      const nextDelay = 250 + Math.random() * 600;
      setTimeout(emitNext, nextDelay);
    };

    setTimeout(emitNext, initialDelay);
  });
};

/**
 * Calcule un score global du document (0-100) à partir des findings.
 * Les findings de priorité élevée pèsent plus lourd.
 */
export const computeDocumentScore = (findings) => {
  if (!findings || findings.length === 0) return 100;

  const weights = { high: 6, medium: 3, low: 1 };
  const penalty = findings.reduce(
    (sum, f) => sum + (weights[f.priority] ?? 1),
    0
  );

  // On part de 100 et on retire la pénalité, plafonnée à 60.
  const score = Math.max(40, 100 - Math.min(penalty, 60));
  return Math.round(score);
};
