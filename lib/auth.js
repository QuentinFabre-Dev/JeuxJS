/**
 * Shared-password session, signed with HMAC-SHA256.
 *
 * No user table, no database: one password for the whole site, and a cookie
 * that proves it was entered. The signature is computed with Web Crypto rather
 * than `node:crypto` because the middleware that checks it also runs on the
 * edge runtime, where the Node built-in does not exist.
 *
 * When `SITE_PASSWORD` is unset — the local development case — authentication
 * is disabled entirely. A developer running `npm run dev` should not have to
 * invent a password to open their own app.
 */

export const SESSION_COOKIE = 'ryder_session';

const TTL_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();

const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const keyFor = (secret) =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

const sign = async (payload, secret) =>
  base64url(await crypto.subtle.sign('HMAC', await keyFor(secret), encoder.encode(payload)));

/** True when no password is configured: the site is open, by design. */
export const authDisabled = (env) => !env.SITE_PASSWORD;

/** Builds the cookie value for a session that expires in TTL_MS. */
export const issueSession = async (secret, now = Date.now()) => {
  const expiry = String(now + TTL_MS);
  return `${expiry}.${await sign(expiry, secret)}`;
};

/**
 * Verifies a cookie value. Returns false on anything suspicious: no cookie,
 * malformed, expired, or signed with another secret.
 */
export const verifySession = async (value, secret, now = Date.now()) => {
  if (!value || !secret) return false;
  const [expiry, signature] = String(value).split('.');
  if (!expiry || !signature) return false;
  if (!/^\d+$/.test(expiry) || Number(expiry) < now) return false;

  const expected = await sign(expiry, secret);
  // Length-independent comparison: the strings are the same size by
  // construction, so a plain char-by-char XOR is enough.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
};

export const cookieOptions = (secure) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure,
  path: '/',
  maxAge: TTL_MS / 1000,
});
