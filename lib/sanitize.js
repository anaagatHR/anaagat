// Allow-list HTML cleaning for editor text and AI blog bodies. Every attribute is dropped except a vetted href,
// and the visually-hidden class that keeps "(opens in a new tab)" hints for screen readers.
const INLINE = new Set(['b', 'strong', 'em', 'i', 'br', 'span']);
const ARTICLE = new Set(['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'br', 'blockquote', 'a']);

export function safeUrl(u) {
  const v = String(u || '').trim();
  if (!v || /[\s"'<>`]/.test(v)) return null;
  return /^(https?:\/\/|\/|#|tel:|mailto:)/i.test(v) ? v : null;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escapeHtml = esc;

function clean(html, allowed) {
  const s = String(html || '')
    .replace(/<(script|style|iframe|object|embed|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  return s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_, close, rawName, attrs) => {
    const name = rawName.toLowerCase();
    if (!allowed.has(name)) return '';
    if (close) return name === 'br' ? '' : `</${name}>`;
    if (name === 'span') return /\bclass\s*=\s*["']visually-hidden["']/i.test(attrs) ? '<span class="visually-hidden">' : '<span>';
    if (name === 'a') {
      const m = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const href = m && safeUrl(m[1] ?? m[2]);
      if (!href) return '<a>';
      return /^https?:/i.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">` : `<a href="${esc(href)}">`;
    }
    return `<${name}>`;
  });
}

export const cleanInline = (html) => clean(html, INLINE).trim();
export const cleanArticle = (html) => clean(html, ARTICLE).trim();
