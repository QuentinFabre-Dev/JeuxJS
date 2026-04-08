// Realistic mock findings pool, grouped by skill.
// Each finding's `original` must match EXACTLY a sentence in
// src/data/mockDocument.js (same page + same text) so that the
// document preview can highlight it.

export const MOCK_FINDINGS_POOL = [
  // ── Grammar ────────────────────────────────────────────────
  {
    skill: 'grammar',
    page: 1,
    original:
      "The sales and marketing teams needs to collaborate more closely.",
    suggestion:
      "The sales and marketing teams need to collaborate more closely.",
    explanation:
      "Subject-verb agreement: the subject is plural, the verb must be plural.",
    priority: 'high',
    confidence: 0.96,
  },
  {
    skill: 'grammar',
    page: 2,
    original:
      "Neither of the documents submitted have been approved by management.",
    suggestion:
      "Neither of the documents submitted has been approved by management.",
    explanation:
      "\u201CNeither\u201D is singular; the verb should agree (has, not have).",
    priority: 'medium',
    confidence: 0.89,
  },
  {
    skill: 'grammar',
    page: 4,
    original:
      "Following Monday's meeting, we has decided to postpone the launch.",
    suggestion:
      "Following Monday's meeting, we have decided to postpone the launch.",
    explanation:
      "The subject \u201Cwe\u201D requires \u201Chave\u201D as the auxiliary verb.",
    priority: 'medium',
    confidence: 0.84,
  },

  // ── Spelling ───────────────────────────────────────────────
  {
    skill: 'spelling',
    page: 1,
    original:
      "The report presents the key figures for the last quater.",
    suggestion:
      "The report presents the key figures for the last quarter.",
    explanation: "Typo: \u201Cquater\u201D \u2192 \u201Cquarter\u201D.",
    priority: 'low',
    confidence: 0.99,
  },
  {
    skill: 'spelling',
    page: 3,
    original:
      "Employees must follow the security procceedure.",
    suggestion:
      "Employees must follow the security procedure.",
    explanation:
      "Misspelling: \u201Cprocceedure\u201D \u2192 \u201Cprocedure\u201D.",
    priority: 'low',
    confidence: 0.98,
  },
  {
    skill: 'spelling',
    page: 5,
    original:
      "The company is committed to respecting its CSR committment.",
    suggestion:
      "The company is committed to respecting its CSR commitments.",
    explanation:
      "\u201Ccommittment\u201D should be \u201Ccommitments\u201D (one \u201Ct\u201D, plural).",
    priority: 'medium',
    confidence: 0.93,
  },

  // ── Consistency / context ──────────────────────────────────
  {
    skill: 'consistency',
    page: 2,
    original:
      "The project will be delivered in Q2 2025 with a budget of \u20ac120k.",
    suggestion:
      "The project will be delivered in Q3 2025 with a budget of \u20ac120k.",
    explanation:
      "Inconsistent with section 4.1 which states a Q3 2025 delivery.",
    priority: 'high',
    confidence: 0.78,
  },
  {
    skill: 'consistency',
    page: 6,
    original:
      "This procedure replaces version v1.2 dated 03/14/2024.",
    suggestion:
      "This procedure replaces version v1.3 dated 03/14/2024.",
    explanation:
      "Version v1.3 is referenced on page 1 \u2014 internal contradiction.",
    priority: 'high',
    confidence: 0.81,
  },
  {
    skill: 'consistency',
    page: 7,
    original:
      "Users can reset their password at any time.",
    suggestion:
      "Users can reset their password once per month (see Security section).",
    explanation:
      "Contradicts the Security section which enforces a monthly limit.",
    priority: 'medium',
    confidence: 0.72,
  },

  // ── Clarity ────────────────────────────────────────────────
  {
    skill: 'clarity',
    page: 3,
    original:
      "Within the framework of the operational implementation of the overall strategy, it will be appropriate, in due course, to articulate the functional building blocks in such a way as to ensure transversal alignment.",
    suggestion:
      "We will align the functional modules with the overall strategy during rollout.",
    explanation:
      "Sentence too long (35+ words) and vague. Rewrite recommended.",
    priority: 'medium',
    confidence: 0.87,
  },
  {
    skill: 'clarity',
    page: 5,
    original:
      "The final deliverable, which will need to be validated by the stakeholders, will be made available.",
    suggestion:
      "Stakeholders will validate the final deliverable before it is made available.",
    explanation: "Prefer the active voice to improve readability.",
    priority: 'low',
    confidence: 0.85,
  },
  {
    skill: 'clarity',
    page: 8,
    original:
      "It is to be noted that a certain number of elements remain to be clarified.",
    suggestion:
      "Several points remain to be clarified: [list the items].",
    explanation:
      "Vague wording \u2014 explicitly list the items that need clarification.",
    priority: 'medium',
    confidence: 0.79,
  },

  // ── Tone / style ───────────────────────────────────────────
  {
    skill: 'tone',
    page: 1,
    original:
      "Hey team, hope you're all good :)",
    suggestion: "Dear all,",
    explanation:
      "Too casual for an external professional communication.",
    priority: 'high',
    confidence: 0.91,
  },
  {
    skill: 'tone',
    page: 4,
    original:
      "It's just impossible to meet this schedule.",
    suggestion:
      "Meeting this schedule represents a significant challenge given the current resources.",
    explanation:
      "Rephrase for a more measured and constructive tone.",
    priority: 'medium',
    confidence: 0.83,
  },
  {
    skill: 'tone',
    page: 6,
    original:
      "Please take care of this ASAP.",
    suggestion:
      "Please address this as soon as possible, ideally by Friday.",
    explanation:
      "Avoid abbreviations and provide a clear deadline.",
    priority: 'low',
    confidence: 0.88,
  },
];
