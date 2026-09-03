/**
 * Business packs.
 *
 * A pack is a **composition, not a new engine**: the vocabulary a practice
 * uses, the requirements it always applies, and a paragraph of context for the
 * prompts. Nothing here executes anything — the checks are the same seven,
 * they are simply told what this document is made of.
 *
 * Packs are **frozen in code**, versioned and read in code review. A glossary
 * decides what is *not* a spelling mistake; letting it be edited at runtime
 * would mean a review whose rules nobody can reconstruct after the fact.
 *
 * This is what finally makes the service-line selector mean something: before
 * this, it was a line of context in a prompt.
 */
import { audit } from './audit.js';
import { cyber } from './cyber.js';
import { finance } from './finance.js';
import { tax } from './tax.js';

/** Service lines with no pack of their own review like everyone else. */
export const GENERIC_PACK = {
  id: 'generic',
  label: 'No specific pack',
  glossary: [],
  requirements: [],
  context: '',
};

export const PACKS = { audit, cyber, finance, tax };

export const packFor = (serviceLine) => PACKS[serviceLine] ?? GENERIC_PACK;
