// Weekly sitemap resubmission to Google Search Console, as a Google service account (no SDK: a signed JWT).
// Setup: README > "Google Search Console". The service account must be added as an Owner of the property.
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));

export async function serviceAccountAssertion(clientEmail, privateKeyPem, scope, now = Math.floor(Date.now() / 1000)) {
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: clientEmail, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  // Keys pasted into env vars often carry literal "\n"; normalise before decoding the PEM body.
  const body = String(privateKeyPem).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(body), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64u(sig)}`;
}

export async function submitSitemap(env, fetchFn = fetch) {
  if (!env.GSC_CLIENT_EMAIL || !env.GSC_PRIVATE_KEY) return 'skipped: GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY not set';
  const assertion = await serviceAccountAssertion(env.GSC_CLIENT_EMAIL, env.GSC_PRIVATE_KEY, 'https://www.googleapis.com/auth/webmasters');
  const t = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!t.ok) return `token error ${t.status}: ${await t.text()}`;
  const { access_token } = await t.json();
  const site = env.GSC_SITE || 'sc-domain:anaagathr.com';
  const feed = `${env.SITE_URL}/sitemap.xml`;
  const r = await fetchFn(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(feed)}`, {
    method: 'PUT', headers: { authorization: `Bearer ${access_token}` },
  });
  return `sitemap submit ${r.status}${r.ok ? '' : `: ${await r.text()}`}`;
}
