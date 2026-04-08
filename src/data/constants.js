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

// Service lines (KPMG-inspired, used as a pre-analysis filter)
export const SERVICE_LINES = [
  { id: 'audit', label: 'Audit & Assurance' },
  { id: 'tax', label: 'Tax & Legal' },
  { id: 'consulting', label: 'Management Consulting' },
  { id: 'cyber', label: 'Cyber Security' },
  { id: 'finance', label: 'Financial Services' },
  { id: 'risk', label: 'Risk Advisory' },
  { id: 'deal', label: 'Deal Advisory' },
  { id: 'tech', label: 'Technology' },
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

// Neutral style used for all skill tags.
// Custom checks keep a slight accent so they stand out.
export const SKILL_CHIP_NEUTRAL =
  'bg-slate-50 text-slate-600 ring-1 ring-slate-200';
export const SKILL_CHIP_CUSTOM =
  'bg-brand-50 text-brand-700 ring-1 ring-brand-200';

export const SKILL_STYLES = {
  grammar: SKILL_CHIP_NEUTRAL,
  spelling: SKILL_CHIP_NEUTRAL,
  consistency: SKILL_CHIP_NEUTRAL,
  clarity: SKILL_CHIP_NEUTRAL,
  tone: SKILL_CHIP_NEUTRAL,
  custom: SKILL_CHIP_CUSTOM,
};
