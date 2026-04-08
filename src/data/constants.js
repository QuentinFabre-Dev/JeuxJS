// Catégories d'analyse ("skills")
export const SKILLS = [
  {
    id: 'grammar',
    label: 'Grammaire',
    description: 'Détection des erreurs de structure grammaticale',
    color: 'violet',
  },
  {
    id: 'spelling',
    label: 'Orthographe',
    description: 'Repérage des fautes d\u2019orthographe et typos',
    color: 'rose',
  },
  {
    id: 'consistency',
    label: 'Cohérence / contexte',
    description: 'Vérification de la cohérence globale du document',
    color: 'amber',
  },
  {
    id: 'clarity',
    label: 'Clarté',
    description: 'Lisibilité, phrases trop longues ou ambigües',
    color: 'sky',
  },
  {
    id: 'tone',
    label: 'Ton / style',
    description: 'Adéquation du ton avec le type de document',
    color: 'emerald',
  },
];

// Types de document
export const DOC_TYPES = [
  { id: 'report', label: 'Rapport interne' },
  { id: 'procedure', label: 'Procédure' },
  { id: 'policy', label: 'Politique' },
  { id: 'email', label: 'Email professionnel' },
  { id: 'other', label: 'Autre' },
];

// Niveaux de priorité
export const PRIORITIES = {
  low: {
    id: 'low',
    label: 'Faible',
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  medium: {
    id: 'medium',
    label: 'Moyenne',
    classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dot: 'bg-amber-500',
  },
  high: {
    id: 'high',
    label: 'Élevée',
    classes: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    dot: 'bg-rose-500',
  },
};

// Couleur Tailwind par skill (utilisée pour les chips)
export const SKILL_STYLES = {
  grammar: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  spelling: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  consistency: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  clarity: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
