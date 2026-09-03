/**
 * Development proxy to a local Ollama. Kept identical to what the Vite proxy
 * did, so the local mode survives the move to Next.js unchanged.
 *
 * In production Ollama runs on nobody's machine that this server can reach:
 * the route answers 502 and the interface falls back to the cloud engine.
 */
import { forward } from '../../../lib/proxy.js';
import { requireSession, unauthorised } from '../../../lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = async (request, { params }) => {
  if (!(await requireSession())) return unauthorised();
  const { path } = await params;
  return forward(request, {
    target: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    path: path.join('/'),
  });
};

export { handler as GET, handler as POST };
