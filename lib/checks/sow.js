/**
 * Contract check: does this deliverable honour the signed statement of work?
 *
 * This is a different question from the quality review, and it needs a
 * different answer shape. A quality finding always points at a sentence that
 * is wrong. A contract gap points at a sentence that is **missing** — there is
 * nothing to highlight, nothing to correct in place. So commitments get their
 * own panel, their own verdicts, and their own summary line, rather than being
 * squeezed into the findings list.
 *
 * Two passes:
 *   1. read the SoW, list what was promised;
 *   2. for each promise, look for it in the deliverable.
 *
 * Between the two sits a free step that matters more than it looks: the
 * candidate sentences for a commitment are pre-selected **locally**, by term
 * overlap. Sending the whole deliverable with every commitment would be the
 * obvious implementation and the expensive one.
 */

/** What the extraction pass returns. */
export const COMMITMENTS_SCHEMA = {
  type: 'object',
  properties: {
    commitments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Short stable reference, e.g. "c1".' },
          text: {
            type: 'string',
            description: 'The commitment, in one sentence, as the contract states it.',
          },
          kind: {
            type: 'string',
            enum: ['deliverable', 'scope', 'exclusion', 'constraint', 'format', 'date'],
          },
          quote: {
            type: 'string',
            description: 'The clause it comes from, copied verbatim from the SoW.',
          },
          critical: {
            type: 'boolean',
            description: 'True when failing it would breach the contract rather than disappoint.',
          },
        },
        required: ['id', 'text', 'kind', 'quote', 'critical'],
        additionalProperties: false,
      },
    },
  },
  required: ['commitments'],
  additionalProperties: false,
};

/** What the verification pass returns. */
export const COMPLIANCE_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The commitment reference, copied exactly.' },
          status: {
            type: 'string',
            enum: ['met', 'partial', 'missing', 'contradicted'],
          },
          evidence: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ids of the deliverable sentences that support the verdict. Empty when missing.',
          },
          explanation: { type: 'string', description: 'One sentence, addressed to the person who signs off.' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['id', 'status', 'evidence', 'explanation', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
};

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'à', 'au', 'aux',
  'en', 'dans', 'pour', 'par', 'sur', 'avec', 'sans', 'que', 'qui', 'est', 'sont',
  'doit', 'doivent', 'sera', 'seront', 'être', 'ce', 'cette', 'ces', 'son', 'sa',
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'for', 'on', 'with', 'shall',
  'will', 'must', 'be', 'is', 'are', 'this', 'that', 'their', 'its',
]);

const terms = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .match(/[\p{L}\d][\p{L}\d-]{2,}/gu)
      ?.filter((word) => !STOP_WORDS.has(word)) ?? []
  );

/**
 * The deliverable sentences worth showing for one commitment.
 *
 * A commitment about "restitution en comité de pilotage" has no reason to be
 * checked against a page on network segmentation. Scoring by shared terms is
 * crude, free and instant — and the fallback keeps the document's opening
 * sentences, where scope and deliverables are usually restated, so a
 * commitment whose vocabulary is entirely absent still gets a fair look.
 */
export const relevantSentences = (commitment, sentences, limit = 40) => {
  const wanted = terms(`${commitment.text} ${commitment.quote ?? ''}`);
  if (!wanted.size) return sentences.slice(0, limit);

  const scored = sentences
    .map((sentence) => {
      const found = terms(sentence.text);
      let score = 0;
      for (const term of wanted) if (found.has(term)) score += 1;
      return { sentence, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.sentence);

  // Nothing matched: the commitment may simply be absent, and the model must
  // be able to say so from something rather than from nothing.
  const fallback = sentences.slice(0, Math.min(limit, 12));
  const chosen = new Map([...scored, ...fallback].map((sentence) => [sentence.id, sentence]));

  // Reading order, always: a verdict that cites p7 before p2 reads as noise.
  return sentences.filter((sentence) => chosen.has(sentence.id));
};

/** Commitments are verified in packets, not one call each. */
export const batchCommitments = (commitments, size = 6) => {
  const batches = [];
  for (let i = 0; i < commitments.length; i += size) {
    batches.push(commitments.slice(i, i + size));
  }
  return batches;
};

const WEIGHT = { met: 1, partial: 0.5, missing: 0, contradicted: 0 };

/**
 * The one line the person signing off actually reads.
 *
 * `breach` is deliberately not a score threshold: a single contradicted
 * commitment, or a missing critical one, is a different kind of problem from
 * a document that is merely thin. Averaging them away would be the whole
 * failure of this feature.
 */
export const rollup = (commitments, verdicts) => {
  const byId = new Map(verdicts.map((verdict) => [verdict.id, verdict]));
  const counts = { met: 0, partial: 0, missing: 0, contradicted: 0, unchecked: 0 };
  let criticalFailures = 0;

  for (const commitment of commitments) {
    const verdict = byId.get(commitment.id);
    if (!verdict) {
      counts.unchecked += 1;
      continue;
    }
    counts[verdict.status] += 1;
    if (commitment.critical && (verdict.status === 'missing' || verdict.status === 'contradicted')) {
      criticalFailures += 1;
    }
  }

  const checked = commitments.length - counts.unchecked;
  const score = checked
    ? Object.entries(WEIGHT).reduce((total, [status, weight]) => total + counts[status] * weight, 0) /
      checked
    : 0;

  const outcome =
    counts.contradicted > 0 || criticalFailures > 0
      ? 'breach'
      : counts.missing > 0 || counts.partial > 0
        ? 'gaps'
        : 'compliant';

  return { counts, score, outcome, criticalFailures, total: commitments.length };
};

/** The sentence the panel puts at the top. */
export const rollupLabel = (summary) => {
  if (!summary.total) return 'No commitment found in the statement of work.';
  const { counts, total } = summary;
  if (summary.outcome === 'compliant') {
    return `All ${total} commitments are honoured.`;
  }
  if (summary.outcome === 'breach') {
    return `${counts.contradicted} contradicted, ${counts.missing} missing out of ${total} — do not send as is.`;
  }
  return `${counts.met} of ${total} honoured, ${counts.partial} partial, ${counts.missing} missing.`;
};
