/**
 * Session check for route handlers — defence in depth behind the middleware.
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, authDisabled, verifySession } from './auth.js';

export const requireSession = async () => {
  if (authDisabled(process.env)) return true;
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, process.env.SITE_PASSWORD);
};

export const unauthorised = () =>
  new Response(JSON.stringify({ error: 'Session expirée.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
