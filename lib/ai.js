// Writes one blog post as JSON. Default provider is Claude through the official SDK; set AI_PROVIDER=custom
// to point at your own server instead (any OpenAI-compatible /chat/completions endpoint: vLLM, Ollama, LM Studio...).
import Anthropic from '@anthropic-ai/sdk';

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    body_html: { type: 'string' },
  },
  required: ['title', 'summary', 'tags', 'body_html'],
  additionalProperties: false,
};

const SYSTEM = `You write the daily blog for Anaagat Humanpower, a payroll, statutory compliance, staffing and workforce deployment company in Jaipur, India, and the parent of the recruitment brand RecruitKr. Readers are HR heads, plant, site and warehouse managers, and owners of training centres in India.

Write one post from the news items you are given.
- Use only facts that appear in the items. Do not add numbers, names, dates, quotes or claims that are not in them. If the items are thin, write a shorter post instead of filling gaps.
- When you rely on an item, link to its URL inline, for example <a href="URL">Source name</a>.
- Structure: a short opening paragraph on what happened, two to four sections with <h2> headings, then a closing section headed "What this means for employers" with practical, general steps. Keep the advice general: no legal advice and no promised outcomes.
- Plain Indian English. No hype words, no emoji. 450 to 750 words.
- body_html may use only these tags: h2, h3, p, ul, ol, li, strong, em, blockquote, a.
- title: under 70 characters and specific. summary: one sentence under 160 characters. tags: two to four short lowercase tags.
- Mention Anaagat Humanpower at most once, only in the closing section.`;

export const aiConfigured = (env) => ((env.AI_PROVIDER || 'anthropic').toLowerCase() === 'anthropic' ? !!env.AI_API_KEY : !!(env.AI_BASE_URL && env.AI_MODEL));

export function buildUserPrompt(topic, items, today) {
  const list = items.map((it, i) => `[${i + 1}] ${it.title}\nSource: ${it.source || 'unknown'} | Published: ${it.date || 'unknown'}\nURL: ${it.link}${it.description && it.description !== it.title ? `\nSnippet: ${it.description}` : ''}`).join('\n\n');
  return `Topic of the day: ${topic.name}\nToday's date: ${today}\n\nNews items:\n\n${list}`;
}

export function parsePost(text) {
  const s = String(text || '');
  const p = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
  if (typeof p.title !== 'string' || typeof p.body_html !== 'string' || !p.title.trim() || !p.body_html.trim()) throw new Error('The AI reply is missing a title or body.');
  return {
    title: p.title.trim(),
    summary: typeof p.summary === 'string' ? p.summary.trim() : '',
    tags: Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5) : [],
    body_html: p.body_html,
  };
}

export async function writePost(env, topic, items, today) {
  const user = buildUserPrompt(topic, items, today);
  const provider = (env.AI_PROVIDER || 'anthropic').toLowerCase();

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: env.AI_API_KEY });
    const res = await client.beta.messages.create({
      model: env.AI_MODEL || 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    });
    if (res.stop_reason === 'refusal') throw new Error('The model declined to write this post.');
    if (res.stop_reason === 'max_tokens') throw new Error('The post was cut off before it finished.');
    return parsePost(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  }

  const r = await fetch(`${String(env.AI_BASE_URL).replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(env.AI_API_KEY ? { authorization: `Bearer ${env.AI_API_KEY}` } : {}) },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [{ role: 'system', content: `${SYSTEM}\n\nReply with only a JSON object with the keys title, summary, tags and body_html.` }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`Your AI server returned ${r.status}.`);
  const data = await r.json();
  return parsePost(data.choices?.[0]?.message?.content);
}
