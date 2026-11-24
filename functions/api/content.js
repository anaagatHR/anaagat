// Inline editor save: merges changed text, links and images into the page or global KV record.
import { json, sameOrigin } from '../../lib/session.js';
import { pagePath, loadRecords, KEY_RE } from '../../lib/content.js';
import { cleanInline, safeUrl } from '../../lib/sanitize.js';

export async function onRequestGet({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401);
  return json(await loadRecords(env, pagePath(new URL(request.url).searchParams.get('path') || '/'), true));
}

export async function onRequestPut({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Bad origin.' }, 403);
  if (!env.CONTENT) return json({ error: 'The content store (KV binding CONTENT) is not set up yet.' }, 503);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.changes !== 'object') return json({ error: 'Nothing to save.' }, 400);

  const path = pagePath(String(body.path || '/'));
  const { page, global } = await loadRecords(env, path, true);
  const before = JSON.stringify({ page, global });
  let saved = 0;
  for (const [k, v] of Object.entries(body.changes)) {
    if (!KEY_RE.test(k) || !v || typeof v !== 'object') continue;
    const target = k.startsWith('g.') ? global : page;
    const entry = { ...(target[k] || {}) };
    if (typeof v.html === 'string') entry.html = cleanInline(v.html).slice(0, 5000);
    if (typeof v.href === 'string') { const u = safeUrl(v.href); if (u) entry.href = u; }
    if (typeof v.src === 'string') { const u = safeUrl(v.src); if (u) entry.src = u; }
    if (typeof v.alt === 'string') entry.alt = v.alt.slice(0, 300);
    target[k] = entry;
    saved++;
  }
  // The previous version is kept for 30 days, so a bad save can be rolled back from the Cloudflare dashboard.
  await env.CONTENT.put(`history:${path}:${Date.now()}`, before, { expirationTtl: 30 * 24 * 3600 });
  await Promise.all([env.CONTENT.put(`page:${path}`, JSON.stringify(page)), env.CONTENT.put('global', JSON.stringify(global))]);
  return json({ ok: true, saved });
}
