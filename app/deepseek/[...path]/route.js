/**
 * Proxy to the DeepSeek API.
 *
 * The key is read here, in the server process, and injected on the way out. It
 * is deliberately NOT prefixed `NEXT_PUBLIC_`: such variables are inlined into
 * the bundle served to the browser, which would make the key public to anyone
 * opening the devtools.
 */
import { forward } from '../../../lib/proxy.js';
import { requireSession, unauthorised } from '../../../lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = async (request, { params }) => {
  if (!(await requireSession())) return unauthorised();
  const { path } = await params;
  const key = process.env.DEEPSEEK_API_KEY;
  return forward(request, {
    target: process.env.DEEPSEEK_HOST || 'https://api.deepseek.com',
    path: path.join('/'),
    // Without a key the request goes out unauthenticated and DeepSeek answers
    // 401, which the client turns into an explicit message.
    headers: key ? { authorization: `Bearer ${key}` } : {},
  });
};

export { handler as GET, handler as POST };
