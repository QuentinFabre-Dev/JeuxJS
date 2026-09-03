/**
 * Client side of the review stream.
 *
 * The server sends the plan, then every finding as it lands, then a summary.
 * Consuming it as a stream rather than awaiting a final payload is what makes
 * a twenty-second review show its first result after four — and what lets the
 * progress bar count real tasks instead of guessing.
 */
import { decodeEvent, splitFrames } from '../../lib/sse.js';

/**
 * @param {object}   request  body sent to /api/analyze
 * @param {object}   handlers { onPlan, onFinding, onDone, onError }
 * @param {AbortSignal} [signal]
 * @returns {Promise<{findings:number, usage:object}>}
 */
export const streamReview = async (request, handlers = {}, signal) => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `La revue a échoué (${response.status}).`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let summary = { findings: 0, usage: {} };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // A chunk boundary can fall anywhere: the trailing fragment waits for the
    // next chunk rather than being parsed half-formed.
    const { frames, rest } = splitFrames(buffer);
    buffer = rest;

    for (const frame of frames) {
      const parsed = decodeEvent(frame);
      if (!parsed) continue;

      switch (parsed.event) {
        case 'plan':
          handlers.onPlan?.(parsed.data);
          break;
        case 'finding':
          handlers.onFinding?.(parsed.data.finding, parsed.data.task);
          break;
        case 'verdict':
          handlers.onVerdict?.(parsed.data);
          break;
        case 'done':
          handlers.onDone?.(parsed.data.task, parsed.data.count);
          break;
        case 'error':
          // A failing check is not a failing review: it is reported and the
          // rest carries on.
          handlers.onError?.(parsed.data.message, parsed.data.task);
          break;
        case 'end':
          summary = parsed.data;
          break;
        default:
          break;
      }
    }
  }

  return summary;
};
