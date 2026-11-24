// Step 2 of Google sign-in: check the state, swap the code for an ID token, check the company domain, set the session.
import { readCookie, sign, sessionCookie, isAllowed } from '../../lib/session.js';

const back = (request, error) => Response.redirect(new URL(`/admin/login?error=${error}`, request.url), 302);

function decodeJwtPayload(jwt) {
  const part = String(jwt).split('.')[1] || '';
  const bin = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('error')) return back(request, 'denied');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== readCookie(request, 'oauth_state')) return back(request, 'state');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: `${url.origin}/auth/callback`, grant_type: 'authorization_code' }),
  });
  if (!r.ok) return back(request, 'google');
  const { id_token } = await r.json();

  // The token came straight from Google's token endpoint over TLS, so its claims are trusted without a signature check
  // (Google's documented exception); we still check who it was issued to and that it has not expired.
  let p;
  try { p = decodeJwtPayload(id_token); } catch { return back(request, 'google'); }
  const issuerOk = p.iss === 'https://accounts.google.com' || p.iss === 'accounts.google.com';
  if (!issuerOk || p.aud !== env.GOOGLE_CLIENT_ID || p.exp * 1000 < Date.now()) return back(request, 'google');
  if (!isAllowed(p, env)) return back(request, 'domain');

  const week = 7 * 24 * 3600;
  const token = await sign({ email: p.email, name: p.name || p.email, picture: p.picture || '', exp: Date.now() + week * 1000 }, env.SESSION_SECRET);
  const headers = new Headers({ location: '/admin' });
  headers.append('set-cookie', sessionCookie(token, week, env.COOKIE_DOMAIN));
  headers.append('set-cookie', 'oauth_state=; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return new Response(null, { status: 302, headers });
}
