// /sitemap.xml: the fixed pages plus every published blog post.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export async function onRequestGet({ request, env }) {
  const base = env.SITE_URL || new URL(request.url).origin;
  const urls = ['/', '/blog', '/privacy', '/terms'].map((p) => ({ loc: base + p }));
  if (env.DB) {
    const { results } = await env.DB.prepare("SELECT slug, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 5000").all();
    for (const p of results || []) urls.push({ loc: `${base}/blog/${p.slug}`, lastmod: String(p.published_at || '').slice(0, 10) });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
