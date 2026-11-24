// Step 1 of Google sign-in: send the visitor to Google with a one-time state value.
export async function onRequestGet({ request, env }) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) {
    return Response.redirect(new URL('/admin/login?error=config', request.url), 302);
  }
  const state = crypto.randomUUID();
  const origin = new URL(request.url).origin;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  const domains = String(env.ALLOWED_DOMAINS || '').split(',').map((d) => d.trim()).filter(Boolean);
  if (domains.length === 1) auth.searchParams.set('hd', domains[0]); // pre-selects the company account in Google's picker
  return new Response(null, {
    status: 302,
    headers: { location: auth.toString(), 'set-cookie': `oauth_state=${state}; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600` },
  });
}
