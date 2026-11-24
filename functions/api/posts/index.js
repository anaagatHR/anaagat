// Admin list of blog posts, drafts first.
import { json } from '../../../lib/session.js';

export async function onRequestGet({ env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401);
  if (!env.DB) return json({ posts: [], error: 'The blog database (D1 binding DB) is not set up yet.' });
  const { results } = await env.DB.prepare(
    "SELECT id, slug, title, summary, body_html, tags, topic, status, created_at, published_at FROM posts ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END, created_at DESC LIMIT 100"
  ).all();
  return json({ posts: results || [] });
}
