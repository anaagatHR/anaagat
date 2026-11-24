// Runs for every request: locks /admin, stitches the shared header and footer into pages,
// applies text/link/image edits saved by the inline editor, and boots the editor for signed-in staff.
import { getUser } from '../lib/session.js';
import { pagePath, loadRecords, applyOverrides } from '../lib/content.js';

const ADMIN_PAGE = /^\/admin(\/|\/index(\.html)?)?$/;
const PARTIALS = ['header', 'footer'];

async function renderPartial(env, url, name, global) {
  const r = await env.ASSETS.fetch(new URL(`/partials/${name}`, url));
  if (!r.ok) return '';
  return applyOverrides(new HTMLRewriter(), global).transform(r).text();
}

const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export async function onRequest(ctx) {
  const { request, env, next, data } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith('/partials/')) return new Response('Not found', { status: 404 });

  const hasCookie = (request.headers.get('cookie') || '').includes('anaagat_session=');
  const user = hasCookie ? await getUser(request, env) : null;
  data.user = user;
  if (ADMIN_PAGE.test(path) && !user) return Response.redirect(`${url.origin}/admin/login`, 302);

  const res = await next();
  if (!(res.headers.get('content-type') || '').includes('text/html') || path.startsWith('/admin')) return res;

  const edit = !!user && url.searchParams.get('edit') === '1';
  const record = res.status === 404 ? '/404' : path.startsWith('/blog/') ? '/blog/_post' : pagePath(path);
  const { page, global } = await loadRecords(env, record, edit);
  const parts = {};
  for (const name of PARTIALS) parts[name] = await renderPartial(env, url, name, global);

  const rw = new HTMLRewriter().on('[data-include]', {
    element(el) { const n = el.getAttribute('data-include'); if (n in parts) el.replace(parts[n], { html: true }); },
  });
  applyOverrides(rw, page);
  if (user) {
    const tail = edit
      ? `<script>document.documentElement.classList.add('is-editing');window.__EDIT=${safeJson({ path: record, email: user.email })};</script><link rel="stylesheet" href="/admin/editor.css"><script src="/admin/editor.js" defer></script>`
      : `<a class="btn btn--small edit-pill" href="${url.pathname}?edit=1">Edit this page</a>`;
    rw.on('body', { element(el) { el.append(tail, { html: true }); } });
  }
  const out = rw.transform(res);
  if (!user) return out;
  const headers = new Headers(out.headers);
  headers.set('cache-control', 'private, no-store');
  return new Response(out.body, { status: out.status, headers });
}
