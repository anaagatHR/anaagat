// Makes today's AI draft. Called by the daily cron Worker (Bearer CRON_SECRET) or by staff from the dashboard.
import { json, sameOrigin } from '../../lib/session.js';
import { generateDraft, HttpError } from '../../lib/blog.js';

export async function onRequestPost({ request, env, data }) {
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const fromCron = !!env.CRON_SECRET && bearer.length > 0 && bearer === env.CRON_SECRET;
  if (!fromCron && !(data.user && sameOrigin(request))) return json({ error: 'Not allowed.' }, 401);
  try {
    return json({ ok: true, draft: await generateDraft(env) });
  } catch (e) {
    return json({ error: e.message || 'Draft generation failed.' }, e instanceof HttpError ? e.status : 502);
  }
}
