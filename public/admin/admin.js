// Dashboard: who is signed in, what still needs setting up, and the blog draft queue.
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var api = function (url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { location.href = '/admin/login'; throw new Error('Signed out'); }
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d; });
    });
  };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var fmt = function (iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : ''; };

  api('/api/me').then(function (d) {
    $('#who').textContent = 'Signed in as ' + d.user.email;
    var missing = [];
    if (!d.setup.content) missing.push('KV namespace bound as CONTENT (saves page edits)');
    if (!d.setup.media) missing.push('R2 bucket bound as MEDIA (image uploads)');
    if (!d.setup.db) missing.push('D1 database bound as DB (blog)');
    if (!d.setup.ai) missing.push('AI_API_KEY, or AI_PROVIDER=custom with AI_BASE_URL and AI_MODEL (blog drafts)');
    if (!d.setup.cron) missing.push('CRON_SECRET (daily draft schedule)');
    if (missing.length) { var s = $('#setup'); s.textContent = 'Still to set up in Cloudflare: ' + missing.join('; ') + '.'; s.hidden = false; }
  }).catch(function () {});

  function renderPosts(posts) {
    var list = $('#posts'); list.textContent = '';
    if (!posts.length) { list.appendChild(el('li', 'dash__empty', 'No posts yet. Press "Write today’s draft now", or wait for the morning run.')); return; }
    posts.forEach(function (p) { list.appendChild(row(p)); });
  }
  function load() { api('/api/posts').then(function (d) { renderPosts(d.posts || []); if (d.error) $('#genStatus').textContent = d.error; }).catch(function (e) { $('#genStatus').textContent = e.message; }); }

  function row(p) {
    var li = el('li', 'post-row');
    var top = el('div', 'post-row__top');
    top.appendChild(el('span', 'chip chip--' + p.status, p.status === 'draft' ? 'Draft' : 'Published'));
    top.appendChild(el('h3', null, p.title));
    li.appendChild(top);
    li.appendChild(el('p', 'post-row__meta', (p.topic ? p.topic + '. ' : '') + 'Written ' + fmt(p.created_at) + (p.published_at ? '. Published ' + fmt(p.published_at) : '') + '.'));
    if (p.summary) li.appendChild(el('p', null, p.summary));

    var acts = el('div', 'post-row__acts');
    var preview = el('a', 'more', p.status === 'draft' ? 'Preview' : 'View'); preview.href = '/blog/' + encodeURIComponent(p.slug); preview.target = '_blank'; preview.rel = 'noopener';
    var edit = el('button', 'btn btn--quiet', 'Edit'); edit.type = 'button';
    var toggle = el('button', 'btn' + (p.status === 'draft' ? '' : ' btn--quiet'), p.status === 'draft' ? 'Publish' : 'Unpublish'); toggle.type = 'button';
    var del = el('button', 'btn btn--quiet', 'Delete'); del.type = 'button';
    [preview, edit, toggle, del].forEach(function (b) { acts.appendChild(b); });
    li.appendChild(acts);

    toggle.addEventListener('click', function () {
      toggle.disabled = true;
      api('/api/posts/' + p.id, { method: 'PATCH', body: JSON.stringify({ status: p.status === 'draft' ? 'published' : 'draft' }) }).then(load).catch(function (e) { toggle.disabled = false; $('#genStatus').textContent = e.message; });
    });
    var armed = false;
    del.addEventListener('click', function () {
      if (!armed) { armed = true; del.textContent = 'Click again to delete'; del.className = 'btn btn--danger'; setTimeout(function () { armed = false; del.textContent = 'Delete'; del.className = 'btn btn--quiet'; }, 4000); return; }
      api('/api/posts/' + p.id, { method: 'DELETE' }).then(load).catch(function (e) { $('#genStatus').textContent = e.message; });
    });
    edit.addEventListener('click', function () {
      var open = li.querySelector('.post-edit'); if (open) { open.remove(); return; }
      var f = el('form', 'post-edit');
      var t = el('input'); t.value = p.title; t.id = 'pt' + p.id;
      var s = el('textarea'); s.value = p.summary || ''; s.rows = 2; s.id = 'ps' + p.id;
      var b = el('div', 'post-edit__body'); b.contentEditable = 'true'; b.innerHTML = p.body_html; b.id = 'pb' + p.id; b.setAttribute('role', 'textbox'); b.setAttribute('aria-multiline', 'true'); b.setAttribute('aria-labelledby', 'pbl' + p.id);
      var lt = el('label', null, 'Title'); lt.htmlFor = t.id;
      var ls = el('label', null, 'Summary'); ls.htmlFor = s.id;
      var lb = el('label', null, 'Post'); lb.id = 'pbl' + p.id;
      var save = el('button', 'btn', 'Save changes'); save.type = 'submit';
      [lt, t, ls, s, lb, b, save].forEach(function (x) { f.appendChild(x); });
      f.addEventListener('submit', function (e) {
        e.preventDefault(); save.disabled = true;
        api('/api/posts/' + p.id, { method: 'PATCH', body: JSON.stringify({ title: t.value, summary: s.value, body_html: b.innerHTML }) })
          .then(function () { $('#genStatus').textContent = 'Saved “' + t.value + '”.'; load(); })
          .catch(function (er) { save.disabled = false; $('#genStatus').textContent = er.message; });
      });
      li.appendChild(f); t.focus();
    });
    return li;
  }

  $('#gen').addEventListener('click', function () {
    var b = $('#gen'), st = $('#genStatus');
    b.disabled = true; b.setAttribute('aria-busy', 'true'); st.textContent = 'Reading today’s news and writing a draft. This takes about a minute…';
    api('/api/generate', { method: 'POST' })
      .then(function (d) { st.textContent = 'New draft: “' + d.draft.title + '”. Read it below, then publish.'; load(); })
      .catch(function (e) { st.textContent = e.message; })
      .then(function () { b.disabled = false; b.removeAttribute('aria-busy'); });
  });

  load();
})();
