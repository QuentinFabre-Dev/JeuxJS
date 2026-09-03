/**
 * Server-sent events for the review stream.
 *
 * A review is a sequence of small facts — this check started, here is a
 * finding, that check is done — and the interface must show each one as it
 * happens. Anything that waits for the end turns a 15-second review into 15
 * seconds of blank screen.
 *
 * The encoder is a pure function so the protocol can be tested without a
 * server.
 */

/** The events a review emits. Keep this list and the client switch in step. */
export const EVENTS = [
  'plan', // { tasks: [{ id, check, engine, scope, page }] } — sent first
  'start', // { task }            a task began
  'finding', // { task, finding }    one result, streamed as it lands
  'done', // { task, count }      a task finished
  'error', // { task, message }    a task failed; the review continues
  'end', // { findings, usage }  the review is over
];

export const encodeEvent = (event, data) => {
  if (!EVENTS.includes(event)) throw new Error(`Événement inconnu : ${event}`);
  // One JSON object per event, on a single line: newlines inside the payload
  // would split the frame and break the client parser.
  return `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
};

/** Parses one SSE frame. Returns null for keep-alive comments and blanks. */
export const decodeEvent = (frame) => {
  const lines = String(frame).split('\n');
  const event = lines.find((line) => line.startsWith('event: '))?.slice(7);
  const data = lines.find((line) => line.startsWith('data: '))?.slice(6);
  if (!event || data === undefined) return null;
  return { event, data: JSON.parse(data) };
};

/**
 * Turns an async generator of `[event, data]` pairs into a streaming Response.
 * Errors thrown by the generator are reported as a final `error` event rather
 * than tearing the connection down: a half-finished review with a visible
 * reason beats a socket that closes silently.
 */
export const eventStream = (generator) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const [event, data] of generator) {
          controller.enqueue(encoder.encode(encodeEvent(event, data)));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(encodeEvent('error', { message: error.message }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Vercel and most reverse proxies buffer unless told otherwise, which
      // would defeat the whole point of streaming.
      'x-accel-buffering': 'no',
    },
  });
};
