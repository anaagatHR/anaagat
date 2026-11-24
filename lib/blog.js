// Daily draft: pick today's topic, read fresh news, have the AI write, store as a draft for a person to publish.
import { topicFor, fetchItems } from './feeds.js';
import { writePost, aiConfigured } from './ai.js';
import { cleanArticle } from './sanitize.js';

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
  .replace(/[\s_-]+/g, '-').slice(0, 70).replace(/-+$/, '') || 'post';

export async function generateDraft(env, now = new Date()) {
  if (!env.DB) throw new HttpError(503, 'The blog database (D1 binding DB) is not set up yet.');
  if (!aiConfigured(env)) throw new HttpError(503, 'AI is not configured yet. Set AI_API_KEY (or AI_PROVIDER=custom with AI_BASE_URL and AI_MODEL).');

  const topic = topicFor(now);
  const recent = await env.DB.prepare('SELECT sources FROM posts ORDER BY created_at DESC LIMIT 60').all();
  const used = new Set((recent.results || []).flatMap((r) => { try { return JSON.parse(r.sources || '[]').map((s) => s.link); } catch { return []; } }));
  const items = (await fetchItems(env, topic)).filter((i) => !used.has(i.link)).slice(0, 10);
  if (items.length < 3) throw new HttpError(422, `Only ${items.length} fresh news items for "${topic.name}" today. Try again later.`);

  const today = now.toISOString().slice(0, 10);
  const post = await writePost(env, topic, items, today);
  const body = cleanArticle(post.body_html);
  const cited = items.filter((i) => body.includes(i.link));
  const sources = (cited.length ? cited : items).map(({ title, link, source }) => ({ title, link, source }));
  const base = `${slugify(post.title)}-${today.replace(/-/g, '')}`;

  const insert = (slug) => env.DB.prepare(
    "INSERT INTO posts (slug, title, summary, body_html, tags, sources, topic, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)"
  ).bind(slug, post.title.slice(0, 140), post.summary.slice(0, 300), body, JSON.stringify(post.tags), JSON.stringify(sources), topic.name, now.toISOString()).run();

  let slug = base;
  try { await insert(slug); } catch { slug = `${base}-${Math.random().toString(36).slice(2, 6)}`; await insert(slug); }
  return { slug, title: post.title, topic: topic.name };
}
