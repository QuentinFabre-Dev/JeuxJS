// Analysis "skills"
export const SKILLS = [
  {
    id: 'grammar',
    label: 'Grammar',
    description: 'Detects grammatical structure errors and agreement issues.',
  },
  {
    id: 'spelling',
    label: 'Spelling',
    description: 'Identifies misspellings and typos.',
  },
  {
    id: 'consistency',
    label: 'Consistency',
    description: 'Verifies overall document consistency and cross-references.',
  },
  {
    id: 'clarity',
    label: 'Clarity',
    description: 'Flags unclear, overly long or ambiguous sentences.',
  },
  {
    id: 'tone',
    label: 'Tone',
    description: 'Checks that the tone matches the document type.',
  },
];

// Document types
export const DOC_TYPES = [
  { id: 'report', label: 'Internal report' },
  { id: 'procedure', label: 'Procedure' },
  { id: 'policy', label: 'Policy' },
  { id: 'email', label: 'Professional email' },
  { id: 'other', label: 'Other' },
];

// Priority levels
export const PRIORITIES = {
  low: {
    id: 'low',
    label: 'Low',
    classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-400',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-400',
  },
  high: {
    id: 'high',
    label: 'High',
    classes: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    dot: 'bg-rose-500',
    bar: 'bg-rose-400',
  },
};

// Tailwind classes per skill (used for chips)
export const SKILL_STYLES = {
  grammar: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  spelling: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  consistency: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  clarity: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
