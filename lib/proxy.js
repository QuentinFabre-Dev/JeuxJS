/**
 * Streaming reverse proxy used by the model routes.
 *
 * The response body is passed through untouched: both Ollama (NDJSON) and the
 * OpenAI-compatible APIs (SSE) emit tokens as they are produced, and buffering
 * them here would turn a live progress bar into a long blank wait.
 */
export const forward = async (request, { target, path, headers = {} }) => {
  const url = new URL(path, target.endsWith('/') ? target : `${target}/`);
  url.search = new URL(request.url).search;

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  let upstream;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json',
        ...headers,
      },
      body,
      // Never cut a generation short: these responses are long by nature.
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
  } catch (error) {
    return Response.json(
      { error: `Service injoignable (${target}) : ${error.message}` },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
};
