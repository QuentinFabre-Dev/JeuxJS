import { NextResponse } from 'next/server';
import { SESSION_COOKIE, authDisabled, cookieOptions, issueSession } from '../../../lib/auth.js';

export const runtime = 'nodejs';

export async function POST(request) {
  if (authDisabled(process.env)) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const { password } = await request.json().catch(() => ({}));
  if (typeof password !== 'string' || password !== process.env.SITE_PASSWORD) {
    // Deliberately vague, and deliberately slow enough not to be a free oracle.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await issueSession(process.env.SITE_PASSWORD),
    cookieOptions(request.nextUrl.protocol === 'https:')
  );
  return response;
}
