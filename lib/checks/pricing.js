/**
 * What a model costs and how fast it answers.
 *
 * Prices are the published per-million-token rates. Throughput and time to
 * first token are order-of-magnitude figures used for the pre-flight estimate:
 * they are replaced by measurements in batch F, and the interface presents the
 * estimate as an estimate until then.
 *
 * The two tiers exist because spelling does not need Opus. The mechanical pass
 * on Haiku is five times cheaper and twice as fast, for a result nothing
 * distinguishes on that task.
 */
export const MODELS = {
  main: {
    id: process.env.ANALYSIS_MODEL_MAIN || 'claude-opus-5',
    label: 'Opus 5',
    inputPerMillion: 5,
    outputPerMillion: 25,
    // Reflection is on by default on Opus 5 and is billed as output; the
    // checks run at effort 'low' precisely to keep this figure honest.
    outputTokensPerSecond: 55,
    firstTokenSeconds: 1.5,
  },
  fast: {
    id: process.env.ANALYSIS_MODEL_FAST || 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    inputPerMillion: 1,
    outputPerMillion: 5,
    outputTokensPerSecond: 120,
    firstTokenSeconds: 0.8,
  },
};

export const modelFor = (tier) => MODELS[tier] ?? MODELS.main;

export const costOf = (tier, { inputTokens = 0, outputTokens = 0 }) => {
  const model = modelFor(tier);
  return (
    (inputTokens * model.inputPerMillion) / 1e6 +
    (outputTokens * model.outputPerMillion) / 1e6
  );
};
