/**
 * The checks a review can run.
 *
 * A check is a declaration, not a class: an id, the skills it covers, the
 * engine that executes it, its scope, and the numbers the estimate is built
 * from. The interface reads this list to build the selector; the planner reads
 * it to turn a selection into tasks; the estimator reads it to say what the
 * review will cost before anyone pays for it.
 *
 * Engines:
 *   'local' — pure JavaScript, in a browser worker. Instant and free: nothing
 *             leaves the page.
 *   'llm'   — a Claude call, through /api/analyze. The only paying engine.
 *             `model: 'fast'` picks Haiku 4.5 for the mechanical pass,
 *             `model: 'main'` picks Opus 5 for anything needing judgement.
 *
 * The distinction that matters is not local versus cloud, it is *which check
 * deserves which engine*: of the seven below, three need no model at all and
 * only three need Opus.
 *
 * `outputTokens` and `inputTokens` are the sizes a typical answer and prompt
 * reach. They are estimates until batch F measures them; the estimator says so
 * to the user rather than pretending to a precision it does not have.
 */

/** Tokens a page of prose weighs, and what a prompt costs before its content. */
export const TOKENS_PER_PAGE = 550;
export const PROMPT_OVERHEAD = 700;

export const CHECKS = [
  {
    id: 'terminology',
    label: 'Terminology',
    description: 'Glossary terms and acronyms defined before they are used.',
    skills: ['consistency'],
    engine: 'local',
    scope: 'document',
    localSeconds: 0.2,
  },
  {
    id: 'figures',
    label: 'Figures and units',
    description: 'Amounts, currencies, units and dates that contradict each other.',
    skills: ['consistency'],
    engine: 'local',
    scope: 'document',
    localSeconds: 0.2,
  },
  {
    id: 'patterns',
    label: 'Pattern requirements',
    description: 'Client requirements a search can settle, such as a name that must not appear.',
    skills: ['custom'],
    engine: 'local',
    scope: 'document',
    localSeconds: 0.2,
  },
  {
    id: 'mechanical',
    prompt: 'mechanical.md',
    label: 'Spelling and grammar',
    description: 'Misspellings, agreement, tenses, punctuation.',
    skills: ['spelling', 'grammar'],
    engine: 'llm',
    model: 'fast',
    scope: 'batch',
    pagesPerBatch: 1,
    outputTokens: 400,
  },
  {
    id: 'clarity-tone',
    prompt: 'clarity-tone.md',
    label: 'Clarity and tone',
    description: 'Unclear or overlong sentences, and a tone that fits the document.',
    skills: ['clarity', 'tone'],
    engine: 'llm',
    model: 'main',
    scope: 'batch',
    pagesPerBatch: 1,
    outputTokens: 450,
  },
  {
    id: 'consistency',
    prompt: 'consistency.md',
    label: 'Cross-page consistency',
    description: 'Contradictions and terminology drift between distant pages.',
    skills: ['consistency'],
    engine: 'llm',
    model: 'main',
    scope: 'document',
    // The whole document never fits: the candidate sentences are capped
    // upstream, which is what this figure reflects.
    inputTokens: 6000,
    outputTokens: 800,
  },
  {
    id: 'requirements',
    prompt: 'requirements.md',
    label: 'Client requirements',
    description: 'Custom checks that need judgement rather than a search.',
    skills: ['custom'],
    engine: 'llm',
    model: 'main',
    scope: 'batch',
    pagesPerBatch: 1,
    outputTokens: 400,
  },
];

export const checkById = (id) => CHECKS.find((check) => check.id === id) ?? null;

/** The checks that cover at least one of the selected skills. */
export const checksForSkills = (skills, registry = CHECKS) =>
  registry.filter((check) => check.skills.some((skill) => skills.includes(skill)));
