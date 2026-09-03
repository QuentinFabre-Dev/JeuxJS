/**
 * What a model costs and how fast it answers.
 *
 * Prices are the published per-million-token rates. Throughput and time to
 * first token are order-of-magnitude figures used for the pre-flight estimate:
 * they are replaced by measurements in batch F, and the interface presents the
 * estimate as an estimate until then.
 *
 * The two tiers exist because spelling does not need the reasoning model. The
 * mechanical pass on the small tier is five times cheaper and twice as fast,
 * for a result nothing distinguishes on that task.
 */
export const MODELS = {
  main: {
    id: process.env.ANALYSIS_MODEL_MAIN || 'gpt-5',
    label: 'GPT-5',
    inputPerMillion: 1.25,
    outputPerMillion: 10,
    // Reasoning tokens are billed as output; the checks run at effort
    // 'minimal' precisely to keep this figure honest.
    outputTokensPerSecond: 60,
    firstTokenSeconds: 1.2,
  },
  fast: {
    id: process.env.ANALYSIS_MODEL_FAST || 'gpt-5-mini',
    label: 'GPT-5 mini',
    inputPerMillion: 0.25,
    outputPerMillion: 2,
    outputTokensPerSecond: 110,
    firstTokenSeconds: 0.7,
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
