// Edit, publish, unpublish or delete one post.
import { json, sameOrigin } from '../../../lib/session.js';
import { cleanArticle } from '../../../lib/sanitize.js';

const guard = (request, env, data) => {
  if (!data.user) return json({ error: 'Sign in first.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Bad origin.' }, 403);
  if (!env.DB) return json({ error: 'The blog database (D1 binding DB) is not set up yet.' }, 503);
  return null;
};

export async function onRequestPatch({ request, env, data, params }) {
  const fail = guard(request, env, data); if (fail) return fail;
  const id = Number(params.id);
  const b = await request.json().catch(() => ({}));
  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return json({ error: 'Post not found.' }, 404);
  const next = {
    title: typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 140) : post.title,
    summary: typeof b.summary === 'string' ? b.summary.trim().slice(0, 300) : post.summary,
    body_html: typeof b.body_html === 'string' && b.body_html.trim() ? cleanArticle(b.body_html) : post.body_html,
    status: b.status === 'published' || b.status === 'draft' ? b.status : post.status,
  };
  const publishedAt = next.status === 'published' ? (post.published_at || new Date().toISOString()) : post.published_at;
  await env.DB.prepare('UPDATE posts SET title = ?, summary = ?, body_html = ?, status = ?, published_at = ? WHERE id = ?')
    .bind(next.title, next.summary, next.body_html, next.status, publishedAt, id).run();
  return json({ ok: true, id, status: next.status, slug: post.slug });
}

export async function onRequestDelete({ request, env, data, params }) {
  const fail = guard(request, env, data); if (fail) return fail;
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(Number(params.id)).run();
  return json({ ok: true });
}
