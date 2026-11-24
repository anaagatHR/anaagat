// Real news in, so the AI writes from sources instead of memory. One topic per day, rotating.
export const TOPICS = [
  { name: 'Hiring trends in India', q: 'hiring jobs India' },
  { name: 'Labour law and compliance', q: 'labour codes OR EPFO OR ESIC India' },
  { name: 'Manufacturing and warehousing workforce', q: 'manufacturing OR warehousing workforce jobs India' },
  { name: 'Recruitment and talent', q: 'recruitment talent acquisition India' },
  { name: 'Skills, training and placement', q: 'skill development training placement India' },
  { name: 'Payroll and HR operations', q: 'payroll salary HR India' },
  { name: 'Retail, e-commerce and logistics hiring', q: 'retail OR ecommerce OR logistics hiring India' },
];

export function topicFor(date = new Date()) {
  const day = Math.floor(date.getTime() / 86400000);
  return TOPICS[day % TOPICS.length];
}

export const googleNewsUrl = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:2d')}&hl=en-IN&gl=IN&ceid=IN:en`;

const decode = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };

export function parseRss(xml) {
  const items = [];
  for (const m of String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const b = m[0];
    const link = tag(b, 'link');
    const title = tag(b, 'title');
    if (!title || !/^https?:\/\//.test(link)) continue;
    items.push({ title, link, source: tag(b, 'source'), date: tag(b, 'pubDate'), description: tag(b, 'description').slice(0, 400) });
  }
  return items;
}

export async function fetchItems(env, topic) {
  const urls = env.BLOG_FEEDS ? String(env.BLOG_FEEDS).split(',').map((s) => s.trim()).filter(Boolean) : [googleNewsUrl(topic.q)];
  const all = [];
  for (const url of urls) {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; site-news-reader/1.0)' } });
    if (r.ok) all.push(...parseRss(await r.text()));
  }
  return all;
}
