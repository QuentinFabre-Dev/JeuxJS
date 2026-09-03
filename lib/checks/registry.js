/**
 * The checks a review can run.
 *
 * A check is a declaration, not a class: an id, the skills it covers, the
 * engine that executes it, and its scope. The interface reads this list to
 * build the selector; the planner reads it to turn a selection into tasks.
 *
 * Engines:
 *   'local' — pure JavaScript, in a browser worker. Instant and free: nothing
 *             leaves the page. Terminology, figures, pattern requirements.
 *   'llm'   — a Claude call, through /api/analyze. The only paying engine.
 *             `model: 'fast'` picks Haiku 4.5 for the mechanical pass,
 *             `model: 'main'` picks Opus 5 for anything needing judgement.
 *
 * The list is filled by the next batches: the deterministic checks in batch B,
 * the model checks in batch C. Keeping it empty here is deliberate — batch 0
 * delivered the transport, and an empty plan is a legitimate plan.
 */
export const CHECKS = [];

export const checkById = (id) => CHECKS.find((check) => check.id === id) ?? null;

/** The checks that cover at least one of the selected skills. */
export const checksForSkills = (skills) =>
  CHECKS.filter((check) => check.skills.some((skill) => skills.includes(skill)));

/** Engine breakdown, for the estimate shown before a review starts. */
export const enginesUsed = (checks) => [...new Set(checks.map((check) => check.engine))];
