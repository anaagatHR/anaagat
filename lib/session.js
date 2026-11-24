// Signed session cookie (HMAC-SHA256 via WebCrypto) and the Google sign-in allow rules.
const enc = new TextEncoder();
const SESSION = 'anaagat_session';

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function sign(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return `${body}.${sig}`;
}

export async function verify(token, secret) {
  if (!token || !secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64u(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(body)));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export const getUser = (request, env) => verify(readCookie(request, SESSION), env.SESSION_SECRET);

export function sessionCookie(value, maxAge) {
  return `${SESSION}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

const list = (v) => String(v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

// Allowed: any verified account of a Google Workspace domain in ALLOWED_DOMAINS (the `hd` claim), or an address in ADMIN_EMAILS.
export function isAllowed(profile, env) {
  if (!profile || !profile.email || profile.email_verified === false) return false;
  const email = profile.email.toLowerCase();
  if (list(env.ADMIN_EMAILS).includes(email)) return true;
  const hd = String(profile.hd || '').toLowerCase();
  return !!hd && list(env.ALLOWED_DOMAINS).includes(hd);
}

// Mutating API calls must come from our own pages (SameSite=Lax already blocks cross-site POSTs; this is the second lock).
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
