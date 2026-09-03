/**
 * The checks a review can run.
 *
 * A check is a declaration, not a class: an id, the skills it covers, the
 * engine that executes it, and its scope. The interface reads this list to
 * build the selector; the planner reads it to turn a selection into tasks.
 *
 * Engines:
 *   'local'        — pure JavaScript, in a browser worker. Instant, free.
 *   'languagetool' — the self-hosted rules engine, through /api/lint.
 *   'llm'          — Claude Opus 5, through /api/analyze. The only paying one.
 *
 * The list is filled by the next batches: LanguageTool and the deterministic
 * checks in batch B, the Opus 5 checks in batch C. Keeping it empty here is
 * deliberate — the transport below is what batch 0 delivers, and an empty plan
 * is a legitimate plan.
 */
export const CHECKS = [];

export const checkById = (id) => CHECKS.find((check) => check.id === id) ?? null;

/** The checks that cover at least one of the selected skills. */
export const checksForSkills = (skills) =>
  CHECKS.filter((check) => check.skills.some((skill) => skills.includes(skill)));

/** Engine breakdown, for the estimate shown before a review starts. */
export const enginesUsed = (checks) => [...new Set(checks.map((check) => check.engine))];
