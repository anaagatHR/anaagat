// /blog/<slug>: one post rendered into the post template. Drafts are visible only to signed-in staff, as a preview.
import { escapeHtml as esc } from '../../lib/sanitize.js';
import { fmtDate } from './index.js';

async function notFound(env, request) {
  const r = await env.ASSETS.fetch(new URL('/404', request.url));
  return new Response(r.body, { status: 404, headers: r.headers });
}

export async function onRequestGet({ request, env, params, data }) {
  if (!env.DB) return notFound(env, request);
  const post = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(String(params.slug)).first();
  if (!post || (post.status !== 'published' && !data.user)) return notFound(env, request);

  const url = new URL(request.url);
  const canonical = `${env.SITE_URL || url.origin}/blog/${post.slug}`;
  let tags = []; let sources = [];
  try { tags = JSON.parse(post.tags || '[]'); } catch {}
  try { sources = JSON.parse(post.sources || '[]'); } catch {}
  const date = post.published_at || post.created_at;
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.summary,
    datePublished: date, mainEntityOfPage: canonical, author: { '@type': 'Organization', name: 'Anaagat Humanpower' },
    publisher: { '@type': 'Organization', name: 'Anaagat Humanpower', logo: { '@type': 'ImageObject', url: `${env.SITE_URL || url.origin}/assets/logo.png` } },
  }).replace(/</g, '\\u003c');
  const set = (html) => ({ element(el) { el.setInnerContent(html, { html: true }); } });
  const attr = (name, value) => ({ element(el) { el.setAttribute(name, value); } });

  const tpl = await env.ASSETS.fetch(new URL('/blog/_post', request.url));
  let rw = new HTMLRewriter()
    .on('title', set(`${esc(post.title)} | Anaagat Humanpower`))
    .on('meta[name="description"]', attr('content', post.summary))
    .on('meta[property="og:title"]', attr('content', post.title))
    .on('meta[property="og:description"]', attr('content', post.summary))
    .on('meta[property="og:url"]', attr('content', canonical))
    .on('link[rel="canonical"]', attr('href', canonical))
    .on('script[data-post="ld"]', set(ld))
    .on('[data-post="title"]', set(esc(post.title)))
    .on('[data-post="summary"]', set(esc(post.summary)))
    .on('[data-post="date"]', { element(el) { el.setAttribute('datetime', date); el.setInnerContent(fmtDate(date)); } })
    .on('[data-post="tags"]', set(tags.map((t) => `<li>${esc(t)}</li>`).join('')))
    .on('[data-post="body"]', set(post.body_html))
    .on('[data-post="sources"]', set(sources.map((s) => `<li><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>${s.source ? ` (${esc(s.source)})` : ''}</li>`).join('')));
  if (post.status !== 'published') {
    rw = rw.on('meta[name="robots"]', attr('content', 'noindex'))
      .on('[data-post="banner"]', { element(el) { el.removeAttribute('hidden'); } });
  }
  return rw.transform(tpl);
}
