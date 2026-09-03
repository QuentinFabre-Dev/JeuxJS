/**
 * Gate in front of everything but the login page and its endpoint.
 *
 * The API routes check the session themselves as well: a serverless function
 * can be invoked directly, and a route that trusts the middleware alone is a
 * route that trusts a hop it cannot see.
 */
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, authDisabled, verifySession } from './lib/auth.js';

export const config = {
  // Everything except Next internals and the public assets the login page and
  // the OCR engine need before a session exists.
  matcher: ['/((?!_next/static|_next/image|favicon.svg|tesseract).*)'],
};

const PUBLIC_PATHS = ['/login', '/api/login', '/api/logout'];

export default async function proxy(request) {
  if (authDisabled(process.env)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(cookie, process.env.SITE_PASSWORD)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}
