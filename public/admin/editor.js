// Inline editor: loaded by the middleware only for signed-in staff on ?edit=1.
// Text: click and type. Links: click to change the address. Pictures: click to replace or describe.
(function () {
  var E = window.__EDIT; if (!E) return;
  var changes = {}, count = 0;
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var entry = function (k) { if (!changes[k]) { changes[k] = {}; count++; } return changes[k]; };

  // toolbar
  var bar = document.createElement('div');
  bar.className = 'ed-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Page editor');
  bar.innerHTML = '<p class="ed-bar__info">Editing <b></b>. <span aria-live="polite"></span></p>'
    + '<button type="button" class="ed-btn ed-btn--primary" data-act="save" disabled>Save</button>'
    + '<button type="button" class="ed-btn" data-act="discard" disabled>Discard</button>'
    + '<a class="ed-btn" data-act="exit">Exit</a><a class="ed-btn" href="/admin">Dashboard</a>';
  bar.querySelector('b').textContent = E.path === '/' ? 'the home page' : E.path;
  bar.querySelector('[data-act="exit"]').href = location.pathname;
  document.body.appendChild(bar);
  var status = bar.querySelector('span'), saveBtn = bar.querySelector('[data-act="save"]'), discardBtn = bar.querySelector('[data-act="discard"]');
  function update(msg) {
    status.textContent = msg || (count ? count + (count === 1 ? ' unsaved change.' : ' unsaved changes.') : 'Click any text, link or picture.');
    saveBtn.disabled = discardBtn.disabled = !count;
  }
  update();

  // text
  $$('[data-edit]').forEach(function (el) {
    el.contentEditable = 'true';
    el.addEventListener('input', function () { entry(el.dataset.edit).html = el.innerHTML; update(); });
    el.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); } });
  });

  // a small panel for link addresses and pictures
  var pop = document.createElement('form');
  pop.className = 'ed-pop'; pop.hidden = true;
  document.body.appendChild(pop);
  function openPop(target, html, onApply) {
    pop.innerHTML = html + '<div class="ed-pop__row"><button type="submit" class="ed-btn ed-btn--primary">Apply</button><button type="button" class="ed-btn" data-close>Cancel</button></div><p class="ed-pop__msg" aria-live="polite"></p>';
    var r = target.getBoundingClientRect();
    pop.style.top = Math.max(8, Math.min(window.innerHeight - 260, r.bottom + 8)) + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 340, r.left)) + 'px';
    pop.hidden = false;
    pop.onsubmit = function (e) { e.preventDefault(); onApply(); };
    pop.querySelector('[data-close]').onclick = function () { pop.hidden = true; };
    var first = pop.querySelector('input'); if (first) first.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') pop.hidden = true;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (count) save(); }
  });

  // Links never navigate while editing; clicking one opens its address.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a || bar.contains(a) || pop.contains(a)) return;
    e.preventDefault();
    if (!a.dataset.edit) return;
    openPop(a, '<label class="ed-pop__label" for="ed-href">Link address</label><input id="ed-href" type="text" spellcheck="false">', function () {
      var v = pop.querySelector('#ed-href').value.trim();
      if (!/^(https?:\/\/|\/|#|tel:|mailto:)/i.test(v)) { pop.querySelector('.ed-pop__msg').textContent = 'Start with https://, /, #, tel: or mailto:'; return; }
      a.setAttribute('href', v); entry(a.dataset.edit).href = v; pop.hidden = true; update();
    });
    pop.querySelector('#ed-href').value = a.getAttribute('href') || '';
  }, true);

  // pictures
  $$('[data-edit-src]').forEach(function (img) {
    img.tabIndex = 0;
    var open = function () {
      openPop(img, '<label class="ed-pop__label" for="ed-file">Replace picture</label><input id="ed-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif">'
        + '<label class="ed-pop__label" for="ed-alt">Description for screen readers</label><input id="ed-alt" type="text">', function () {
        var file = pop.querySelector('#ed-file').files[0], alt = pop.querySelector('#ed-alt').value.trim(), msg = pop.querySelector('.ed-pop__msg');
        var k = img.dataset.editSrc;
        var done = function () { if (alt) { img.alt = alt; entry(k).alt = alt; } pop.hidden = true; update(); };
        if (!file) { done(); return; }
        msg.textContent = 'Uploading…';
        var fd = new FormData(); fd.append('file', file);
        fetch('/api/upload', { method: 'POST', body: fd }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Upload failed.'); return d; }); })
          .then(function (d) { img.removeAttribute('srcset'); img.src = d.url; entry(k).src = d.url; done(); })
          .catch(function (er) { msg.textContent = er.message; });
      });
      pop.querySelector('#ed-alt').value = img.alt || '';
    };
    img.addEventListener('click', function (e) { e.preventDefault(); open(); });
    img.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
  });

  // Forms never submit while editing.
  document.addEventListener('submit', function (e) { if (!pop.contains(e.target)) e.preventDefault(); }, true);

  function save() {
    saveBtn.disabled = true; update('Saving…');
    fetch('/api/content', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: E.path, changes: changes }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Save failed.'); return d; }); })
      .then(function () { changes = {}; count = 0; update('Saved. Visitors see it within a minute.'); })
      .catch(function (e) { update(e.message); saveBtn.disabled = false; });
  }
  saveBtn.addEventListener('click', save);
  discardBtn.addEventListener('click', function () { changes = {}; count = 0; location.reload(); });
  window.addEventListener('beforeunload', function (e) { if (count) { e.preventDefault(); e.returnValue = ''; } });
})();
