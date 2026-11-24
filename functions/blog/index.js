// /blog: the static template with the published posts filled in. /hi/blog reuses renderBlogList.
import { escapeHtml as esc } from '../../lib/sanitize.js';

export const fmtDate = (iso, locale = 'en-IN') => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const tagsHtml = (json) => { let t = []; try { t = JSON.parse(json || '[]'); } catch {} return t.length ? `<ul class="tags">${t.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; };

export async function renderBlogList({ request, env }, template, locale) {
  const tpl = await env.ASSETS.fetch(new URL(template, request.url));
  if (!env.DB) return tpl;
  const { results } = await env.DB.prepare("SELECT slug, title, summary, tags, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 60").all();
  if (!results || !results.length) return tpl;
  const list = `<ul class="posts">${results.map((p) => `<li><a class="post-card" href="/blog/${esc(p.slug)}" hreflang="en"><time datetime="${esc(p.published_at)}">${fmtDate(p.published_at, locale)}</time><h2 lang="en">${esc(p.title)}</h2><p lang="en">${esc(p.summary)}</p>${tagsHtml(p.tags)}</a></li>`).join('')}</ul>`;
  return new HTMLRewriter().on('[data-blog-list]', { element(el) { el.setInnerContent(list, { html: true }); } }).transform(tpl);
}

export const onRequestGet = (ctx) => renderBlogList(ctx, '/blog/', 'en-IN');
