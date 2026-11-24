// /sitemap.xml, built on request, so a newly published blog post appears in it at once (cached for 10 minutes).
// English/Hindi page pairs carry hreflang alternates so Google serves the right language.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const PAIRS = [['/', '/hi/'], ['/blog', '/hi/blog']];
const SINGLE = ['/privacy', '/terms'];

export async function onRequestGet({ request, env }) {
  const base = env.SITE_URL || new URL(request.url).origin;
  let posts = [];
  if (env.DB) {
    const { results } = await env.DB.prepare("SELECT slug, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 5000").all();
    posts = results || [];
  }
  const newest = posts[0] ? String(posts[0].published_at).slice(0, 10) : '';
  const url = (loc, { lastmod, alt } = {}) => `  <url><loc>${esc(base + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${alt ? alt : ''}</url>`;
  const lines = [];
  for (const [en, hi] of PAIRS) {
    const alt = `<xhtml:link rel="alternate" hreflang="en" href="${esc(base + en)}"/><xhtml:link rel="alternate" hreflang="hi" href="${esc(base + hi)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(base + en)}"/>`;
    const lastmod = en === '/blog' ? newest : '';
    lines.push(url(en, { lastmod, alt }), url(hi, { lastmod, alt }));
  }
  for (const p of SINGLE) lines.push(url(p));
  for (const p of posts) lines.push(url(`/blog/${p.slug}`, { lastmod: String(p.published_at || '').slice(0, 10) }));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${lines.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
