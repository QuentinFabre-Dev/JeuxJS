// Banque de findings fictifs mais réalistes.
// Chaque finding est associé à un "skill" et peut être généré
// pour n'importe quel document.

export const MOCK_FINDINGS_POOL = [
  // ── Grammaire ──────────────────────────────────────────────
  {
    skill: 'grammar',
    page: 1,
    original:
      "Les équipes commerciales et marketing doit collaborer plus étroitement.",
    suggestion:
      "Les équipes commerciales et marketing doivent collaborer plus étroitement.",
    explanation: "Accord sujet-verbe : sujet pluriel \u2192 verbe au pluriel.",
    priority: 'high',
    confidence: 0.96,
  },
  {
    skill: 'grammar',
    page: 2,
    original:
      "Aucun des documents transmis n\u2019ont été validés par la direction.",
    suggestion:
      "Aucun des documents transmis n\u2019a été validé par la direction.",
    explanation:
      "« Aucun » est singulier, le verbe et le participe doivent l\u2019être également.",
    priority: 'medium',
    confidence: 0.89,
  },
  {
    skill: 'grammar',
    page: 4,
    original:
      "Suite à la réunion de lundi, on a décidés de reporter le lancement.",
    suggestion:
      "Suite à la réunion de lundi, nous avons décidé de reporter le lancement.",
    explanation:
      "Le sujet « on » entraîne un participe au singulier ; préférer « nous » dans un document professionnel.",
    priority: 'medium',
    confidence: 0.84,
  },

  // ── Orthographe ────────────────────────────────────────────
  {
    skill: 'spelling',
    page: 1,
    original:
      "Le rapport présente les chifres clés du dernier trimestre.",
    suggestion:
      "Le rapport présente les chiffres clés du dernier trimestre.",
    explanation: "Faute d\u2019orthographe : « chifres » \u2192 « chiffres ».",
    priority: 'low',
    confidence: 0.99,
  },
  {
    skill: 'spelling',
    page: 3,
    original:
      "Les colaborateurs doivent suivre la procédure de sécurité.",
    suggestion:
      "Les collaborateurs doivent suivre la procédure de sécurité.",
    explanation: "« colaborateurs » \u2192 « collaborateurs » (deux « l »).",
    priority: 'low',
    confidence: 0.98,
  },
  {
    skill: 'spelling',
    page: 5,
    original:
      "L\u2019entreprise s\u2019engage à respecter les engagement RSE.",
    suggestion:
      "L\u2019entreprise s\u2019engage à respecter les engagements RSE.",
    explanation: "Accord pluriel manquant sur « engagements ».",
    priority: 'medium',
    confidence: 0.93,
  },

  // ── Cohérence / contexte ───────────────────────────────────
  {
    skill: 'consistency',
    page: 2,
    original:
      "Le projet sera livré au T2 2025 avec un budget de 120 k\u20ac.",
    suggestion:
      "Le projet sera livré au T3 2025 avec un budget de 120 k\u20ac.",
    explanation:
      "Incohérence avec la section 4.1 qui mentionne une livraison T3 2025.",
    priority: 'high',
    confidence: 0.78,
  },
  {
    skill: 'consistency',
    page: 6,
    original:
      "Cette procédure remplace la version v1.2 datée du 14/03/2024.",
    suggestion:
      "Cette procédure remplace la version v1.3 datée du 14/03/2024.",
    explanation:
      "La version v1.3 est mentionnée en page 1, contradiction interne.",
    priority: 'high',
    confidence: 0.81,
  },
  {
    skill: 'consistency',
    page: 7,
    original:
      "Les utilisateurs peuvent réinitialiser leur mot de passe à tout moment.",
    suggestion:
      "Les utilisateurs peuvent réinitialiser leur mot de passe une fois par mois (cf. section Sécurité).",
    explanation:
      "Contradiction avec la section Sécurité qui impose une limite mensuelle.",
    priority: 'medium',
    confidence: 0.72,
  },

  // ── Clarté ─────────────────────────────────────────────────
  {
    skill: 'clarity',
    page: 3,
    original:
      "Dans le cadre de la mise en \u0153uvre opérationnelle de la stratégie globale, il conviendra, le moment venu, d\u2019articuler les briques fonctionnelles de manière à garantir un alignement transverse.",
    suggestion:
      "Nous alignerons les modules fonctionnels avec la stratégie globale lors du déploiement.",
    explanation:
      "Phrase trop longue (32 mots) et vocabulaire flou. Réécriture recommandée.",
    priority: 'medium',
    confidence: 0.87,
  },
  {
    skill: 'clarity',
    page: 5,
    original:
      "Le livrable final, qui devra être validé par les parties prenantes, sera mis à disposition.",
    suggestion:
      "Les parties prenantes valideront le livrable final avant sa mise à disposition.",
    explanation:
      "Préférer la voix active pour améliorer la lisibilité.",
    priority: 'low',
    confidence: 0.85,
  },
  {
    skill: 'clarity',
    page: 8,
    original:
      "Il est à noter qu\u2019un certain nombre d\u2019éléments restent à clarifier.",
    suggestion:
      "Plusieurs points restent à clarifier : [lister les éléments].",
    explanation:
      "Formulation vague \u2014 préciser les éléments concernés.",
    priority: 'medium',
    confidence: 0.79,
  },

  // ── Ton / style ────────────────────────────────────────────
  {
    skill: 'tone',
    page: 1,
    original:
      "Salut l\u2019équipe, j\u2019espère que vous allez bien :)",
    suggestion:
      "Bonjour à toutes et à tous,",
    explanation:
      "Ton trop familier pour un email professionnel externe.",
    priority: 'high',
    confidence: 0.91,
  },
  {
    skill: 'tone',
    page: 4,
    original:
      "C\u2019est juste impossible de respecter ce planning.",
    suggestion:
      "Le respect de ce planning représente un défi important compte tenu des ressources actuelles.",
    explanation:
      "Reformulation pour un ton plus mesuré et constructif.",
    priority: 'medium',
    confidence: 0.83,
  },
  {
    skill: 'tone',
    page: 6,
    original:
      "Merci de bien vouloir faire le nécessaire ASAP.",
    suggestion:
      "Merci de traiter ce point dès que possible, idéalement avant vendredi.",
    explanation:
      "Éviter les anglicismes et préciser une échéance claire.",
    priority: 'low',
    confidence: 0.88,
  },
];
