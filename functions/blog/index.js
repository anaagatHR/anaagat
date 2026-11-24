// /blog: the static template with the published posts filled in.
import { escapeHtml as esc } from '../../lib/sanitize.js';

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const tagsHtml = (json) => { let t = []; try { t = JSON.parse(json || '[]'); } catch {} return t.length ? `<ul class="tags">${t.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; };

export async function onRequestGet({ request, env }) {
  const tpl = await env.ASSETS.fetch(new URL('/blog/', request.url));
  if (!env.DB) return tpl;
  const { results } = await env.DB.prepare("SELECT slug, title, summary, tags, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 60").all();
  if (!results || !results.length) return tpl;
  const list = `<ul class="posts">${results.map((p) => `<li><a class="post-card" href="/blog/${esc(p.slug)}"><time datetime="${esc(p.published_at)}">${fmtDate(p.published_at)}</time><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p>${tagsHtml(p.tags)}</a></li>`).join('')}</ul>`;
  return new HTMLRewriter().on('[data-blog-list]', { element(el) { el.setInnerContent(list, { html: true }); } }).transform(tpl);
}
