// Edited text, links and images live in KV as JSON records: `page:<path>` for one page, `global` for the shared header and footer.
// Keys starting with "g." belong to the global record.
export const KEY_RE = /^[a-z0-9][a-z0-9._-]{0,80}$/;

export function pagePath(pathname) {
  let p = pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

export async function loadRecords(env, path, fresh) {
  if (!env.CONTENT) return { page: {}, global: {} };
  const opts = fresh ? { type: 'json' } : { type: 'json', cacheTtl: 60 };
  const [page, global] = await Promise.all([env.CONTENT.get(`page:${path}`, opts), env.CONTENT.get('global', opts)]);
  return { page: page || {}, global: global || {} };
}

// Registers one HTMLRewriter handler per edited key.
export function applyOverrides(rw, map) {
  for (const [k, v] of Object.entries(map || {})) {
    if (!KEY_RE.test(k) || !v) continue;
    rw.on(`[data-edit="${k}"]`, {
      element(el) {
        if (typeof v.html === 'string') el.setInnerContent(v.html, { html: true });
        if (typeof v.href === 'string' && el.tagName === 'a') el.setAttribute('href', v.href);
      },
    });
    rw.on(`[data-edit-src="${k}"]`, {
      element(el) {
        if (typeof v.src === 'string') el.setAttribute('src', v.src);
        if (typeof v.alt === 'string') el.setAttribute('alt', v.alt);
        if (v.src) { el.removeAttribute('srcset'); el.removeAttribute('width'); el.removeAttribute('height'); }
      },
    });
  }
  return rw;
}
