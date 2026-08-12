/**
 * Playbooks: named sets of custom checks, saved per service line.
 *
 * Retyping "no client name in the body" on every run is how a review tool stops
 * being used. A playbook makes a team's review criteria reusable.
 */

const STORAGE_KEY = 'ryder.playbooks';

/** Starter playbooks, shown until the user saves their own. */
export const DEFAULT_PLAYBOOKS = [
  {
    id: 'seed-audit',
    name: 'Audit deliverable',
    serviceLine: 'audit',
    checks: [
      'Every figure quoted in the text must also appear in the appendix',
      'No client name outside the cover page',
      'Conclusions must be stated before their justification',
    ],
  },
  {
    id: 'seed-gdpr',
    name: 'GDPR review',
    serviceLine: 'risk',
    checks: [
      'GDPR compliance: no personal data in examples',
      'Data retention periods must be explicit',
    ],
  },
];

export const loadPlaybooks = () => {
  if (typeof localStorage === 'undefined') return DEFAULT_PLAYBOOKS;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(stored) ? stored : DEFAULT_PLAYBOOKS;
  } catch {
    return DEFAULT_PLAYBOOKS;
  }
};

const persist = (playbooks) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playbooks));
  } catch {
    /* storage unavailable: playbooks stay in memory for this session */
  }
  return playbooks;
};

export const savePlaybook = (playbooks, { name, serviceLine, checks }) => {
  const clean = name.trim();
  if (!clean || !checks.length) return playbooks;

  const existing = playbooks.findIndex(
    (playbook) => playbook.name.toLowerCase() === clean.toLowerCase()
  );
  const entry = {
    id: existing === -1 ? `pb-${Date.now().toString(36)}` : playbooks[existing].id,
    name: clean,
    serviceLine,
    checks: [...checks],
  };

  const next =
    existing === -1
      ? [...playbooks, entry]
      : playbooks.map((playbook, index) => (index === existing ? entry : playbook));

  return persist(next);
};

export const deletePlaybook = (playbooks, id) =>
  persist(playbooks.filter((playbook) => playbook.id !== id));
