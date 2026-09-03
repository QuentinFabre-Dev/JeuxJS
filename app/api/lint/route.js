/**
 * Proxy to the self-hosted LanguageTool.
 *
 * The service is not exposed publicly: it answers only through this route, so
 * it inherits the session check and cannot be used as an open proofreading API
 * by anyone who finds its address.
 *
 * LanguageTool returns matches with `offset` and `length` in the submitted
 * text, which is exactly what the viewer needs to highlight them — the mapping
 * onto sentences and page rectangles is done client-side, where the anchors
 * live.
 */
import { requireSession, unauthorised } from '../../../lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOST = process.env.LANGUAGETOOL_HOST || 'http://127.0.0.1:8010';

export async function POST(request) {
  if (!(await requireSession())) return unauthorised();

  const { text, language = 'auto', dictionary = [] } = await request
    .json()
    .catch(() => ({}));

  if (typeof text !== 'string' || !text.trim()) {
    return Response.json({ matches: [] });
  }

  const form = new URLSearchParams({ text, language });
  // The business glossary goes in as a user dictionary: without it every
  // acronym in a cyber report comes back as a spelling mistake.
  if (dictionary.length) form.set('dicts', dictionary.join(','));

  try {
    const upstream = await fetch(`${HOST}/v2/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `LanguageTool a répondu ${upstream.status}.` },
        { status: 502 }
      );
    }
    return Response.json(await upstream.json());
  } catch (error) {
    // Explicitly unavailable, never silently empty: a review that reports no
    // mistake because the corrector was down is worse than no review.
    return Response.json(
      { error: `Correcteur injoignable : ${error.message}` },
      { status: 503 }
    );
  }
}
