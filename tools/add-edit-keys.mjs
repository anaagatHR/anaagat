#!/usr/bin/env node
// Gives every editable piece of text, link and picture a stable key (data-edit / data-edit-src) so the inline
// editor's saves always land on the same element. Re-run after adding markup: existing keys are kept and new
// elements get the next free number. Usage: node tools/add-edit-keys.mjs [files...]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = {
  'public/partials/header.html': 'g.h', 'public/partials/footer.html': 'g.f', 'public/index.html': 'home',
  'public/privacy.html': 'privacy', 'public/terms.html': 'terms', 'public/404.html': 'nf',
  'public/blog/index.html': 'blog', 'public/blog/_post.html': 'post',
  'public/partials/header-hi.html': 'g.hih', 'public/partials/footer-hi.html': 'g.hif', 'public/hi/index.html': 'hi', 'public/hi/blog/index.html': 'hiblog',
};
const TEXT = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'figcaption', 'dt', 'dd', 'a', 'b', 'span', 'blockquote', 'time']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'svg', 'select', 'textarea', 'head']);
const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

// Simple = text plus inline formatting only, so the editor can own the element's whole innerHTML.
export function simpleInner(inner) {
  if (!inner.replace(/<[^>]*>/g, '').trim()) return false;
  for (const t of inner.match(/<\/?[a-zA-Z][^>]*>/g) || []) {
    const m = t.match(/^<(\/?)([a-zA-Z0-9]+)([^>]*)>/);
    const name = m[2].toLowerCase(), attrs = m[3];
    if (['b', 'strong', 'em', 'i', 'br'].includes(name) && !/\b(class|style|id)=/.test(attrs)) continue;
    if (name === 'span' && (m[1] || /class="(visually-hidden|fill)"/.test(attrs))) continue;
    return false;
  }
  return true;
}

export function addKeys(html, prefix) {
  const found = []; const stack = []; let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    const [whole, close, rawName, attrs] = m; const name = rawName.toLowerCase();
    if (!close) {
      if (RAW.has(name)) { const end = html.indexOf(`</${name}`, TAG.lastIndex); TAG.lastIndex = end < 0 ? html.length : end; continue; }
      if (VOID.has(name) || whole.endsWith('/>')) { if (name === 'img') found.push({ img: true, at: m.index + whole.length - 1, attrs }); continue; }
      stack.push({ name, start: m.index, openEnd: m.index + whole.length, attrs });
    } else {
      let i = stack.length - 1; while (i >= 0 && stack[i].name !== name) i--;
      if (i < 0) continue;
      const el = stack[i]; stack.length = i;
      const skip = /\bdata-(post|include|noedit|blog-list)\b/.test(el.attrs) || /class="[^"]*\b(visually-hidden|tile|caret)\b/.test(el.attrs);
      const hiddenAncestor = stack.some((x) => /aria-hidden="true"|\bdata-noedit\b/.test(x.attrs));
      if (TEXT.has(name) && !skip && !hiddenAncestor && simpleInner(html.slice(el.openEnd, m.index))) found.push({ ...el, end: TAG.lastIndex });
    }
  }
  // Keep the outermost text element only, so a key never sits inside another key.
  const text = found.filter((f) => !f.img).sort((a, b) => a.start - b.start);
  const keep = text.filter((f) => !text.some((o) => o !== f && o.start <= f.start && o.end >= f.end));
  const used = new Set([...html.matchAll(/data-edit(?:-src)?="([^"]+)"/g)].map((x) => x[1]));
  let n = 0; const next = (tag) => { let k; do { k = `${prefix}.${tag}${++n}`; } while (used.has(k)); used.add(k); return k; };
  const inserts = [];
  for (const f of keep) if (!/\bdata-edit=/.test(f.attrs)) inserts.push({ at: f.openEnd - 1, text: ` data-edit="${next(f.name)}"` });
  for (const f of found.filter((x) => x.img)) if (!/\bdata-edit-src=/.test(f.attrs)) inserts.push({ at: f.at - (html[f.at - 1] === '/' ? 1 : 0), text: ` data-edit-src="${next('img')}"` });
  inserts.sort((a, b) => b.at - a.at);
  let out = html; for (const i of inserts) out = out.slice(0, i.at) + i.text + out.slice(i.at);
  return { html: out, added: inserts.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FILES);
  for (const file of targets) {
    const prefix = FILES[file.replace(/\\/g, '/')] || file.replace(/^.*[\\/]/, '').replace(/\.html$/, '');
    const { html, added } = addKeys(fs.readFileSync(file, 'utf8'), prefix);
    if (added) fs.writeFileSync(file, html);
    console.log(`${file}: ${added} new key(s)`);
  }
}
