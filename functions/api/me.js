import { json } from '../../lib/session.js';
import { aiConfigured } from '../../lib/ai.js';

// Who is signed in, and which Cloudflare pieces are wired, so the dashboard can say what still needs setting up.
export function onRequestGet({ env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401);
  return json({ user: data.user, setup: { ai: aiConfigured(env), db: !!env.DB, content: !!env.CONTENT, media: !!env.MEDIA, cron: !!env.CRON_SECRET } });
}
