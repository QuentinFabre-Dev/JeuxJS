/**
 * The checks that need no model.
 *
 * They run on the main thread, and that is a measured decision rather than an
 * oversight: on a 200-page document the three of them together take a handful
 * of milliseconds, which a Web Worker would not improve — it would only add a
 * bundling step and a message protocol. The batch F bench keeps that figure
 * honest; the day it stops being milliseconds, the worker is one file away.
 */
import { checkTerminology } from './terminology.js';
import { checkFigures } from './figures.js';
import { checkPatterns, isPatternRequirement } from './patterns.js';

export { isPatternRequirement, quotedTerms } from './patterns.js';

export const LOCAL_CHECKS = {
  terminology: checkTerminology,
  figures: checkFigures,
  patterns: checkPatterns,
};

/**
 * Runs the selected deterministic checks over a document.
 *
 * @param {string[]} checkIds   ids from the registry, `engine: 'local'`
 * @param {{id:string, page:number, text:string}[]} sentences
 * @param {object} context      { glossary, requirements, exemptPages }
 * @returns raw candidates, in the same shape the model returns, so they go
 *          through `normaliseFinding` like everything else.
 */
export const runLocalChecks = (checkIds, sentences, context = {}) =>
  checkIds.flatMap((id) => LOCAL_CHECKS[id]?.(sentences, context) ?? []);

/** Splits custom checks into what a search decides and what the model must. */
export const splitRequirements = (requirements = []) => ({
  pattern: requirements.filter(isPatternRequirement),
  semantic: requirements.filter((requirement) => !isPatternRequirement(requirement)),
});
