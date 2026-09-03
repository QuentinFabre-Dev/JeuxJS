/**
 * Guard rails on what one request, and one visitor, may spend.
 *
 * The shared password decides *who* gets in. It says nothing about *how much*
 * they may burn once inside, and the two are different problems: a password
 * that leaks, a tab left open on a loop, or an honest colleague dropping a
 * 400-page PDF all cost the same money.
 *
 * Two mechanisms, and they are not equally strong:
 *
 *   - **Per-request caps are hard.** A review is refused before any call is
 *     made when it would exceed them. Nothing works around this.
 *   - **The rate limit is best effort.** It counts in the memory of one
 *     serverless instance, so it resets on a cold start and does not see the
 *     other instances. It slows a mistake down; it does not stop someone
 *     determined.
 *
 * The real backstop is neither of these: it is a **monthly spend limit on the
 * OpenAI account**. Anything in this file can be worked around by someone who
 * wants to; a cap set at the provider cannot.
 */

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const limits = () => ({
  // A 400-page deliverable is a mistake or an attack, not a review.
  maxPages: number(process.env.MAX_PAGES, 80),
  // The number of model calls one review may fan out to.
  maxCalls: number(process.env.MAX_CALLS_PER_REVIEW, 200),
  // Reviews one visitor may launch per hour.
  reviewsPerHour: number(process.env.REVIEWS_PER_HOUR, 30),
});

/**
 * Refuses a review that would cost too much, before a single call goes out.
 * @returns {string|null} the reason to refuse, or null to proceed.
 */
export const refuseOversized = ({ pageCount, callCount }, config = limits()) => {
  if (pageCount > config.maxPages) {
    return `Ce document fait ${pageCount} pages, au-delà de la limite de ${config.maxPages}. Découpez-le, ou relevez MAX_PAGES.`;
  }
  if (callCount > config.maxCalls) {
    return `Cette sélection demande ${callCount} appels de modèle, au-delà de la limite de ${config.maxCalls}. Décochez des contrôles, ou relevez MAX_CALLS_PER_REVIEW.`;
  }
  return null;
};

// Sliding window per visitor. A Map on a serverless instance: deliberately
// modest, and honest about it — see the note at the top of this file.
const windows = new Map();

export const rateLimit = (key, config = limits(), now = Date.now()) => {
  const hour = 60 * 60 * 1000;
  const recent = (windows.get(key) ?? []).filter((stamp) => now - stamp < hour);

  if (recent.length >= config.reviewsPerHour) {
    const retryIn = Math.ceil((hour - (now - recent[0])) / 60000);
    windows.set(key, recent);
    return {
      allowed: false,
      reason: `Limite de ${config.reviewsPerHour} revues par heure atteinte. Réessayez dans ${retryIn} min.`,
    };
  }

  recent.push(now);
  windows.set(key, recent);

  // The map would otherwise grow for the lifetime of the instance.
  if (windows.size > 5000) {
    for (const [entry, stamps] of windows) {
      if (!stamps.some((stamp) => now - stamp < hour)) windows.delete(entry);
    }
  }

  return { allowed: true, remaining: config.reviewsPerHour - recent.length };
};

/** Who to count against: the session first, the address as a fallback. */
export const visitorKey = (request) =>
  request.cookies?.get?.('ryder_session')?.value ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'anonymous';

/** Test seam: forget every counted window. */
export const resetRateLimits = () => windows.clear();
