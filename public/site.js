// Shared behaviour for every public page. Each block checks its elements exist, because pages differ.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(pointer: fine)').matches;
  var editing = document.documentElement.classList.contains('is-editing');

  // menu + dropdowns
  var menu = $('#menu'), tog = $('#menuToggle');
  if (menu && tog) {
    tog.addEventListener('click', function () { var o = menu.classList.toggle('open'); tog.setAttribute('aria-expanded', o); });
    var dds = $$('.menu .dd');
    var closeAll = function (ex) { dds.forEach(function (d) { if (d !== ex) { d.classList.remove('open'); $('button', d).setAttribute('aria-expanded', 'false'); } }); };
    dds.forEach(function (d) {
      var b = $('button', d);
      b.addEventListener('click', function (e) { e.stopPropagation(); var o = !d.classList.contains('open'); closeAll(d); d.classList.toggle('open', o); b.setAttribute('aria-expanded', o); });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.dd')) closeAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { closeAll(); menu.classList.remove('open'); tog.setAttribute('aria-expanded', 'false'); }); });
  }
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // hero track: tilts toward a fine pointer
  var track = $('.track');
  if (track && !still) {
    var wrap = track.parentNode;
    wrap.addEventListener('pointermove', function (e) { var r = wrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; track.style.setProperty('--rx', (4 - y * 8).toFixed(2) + 'deg'); track.style.setProperty('--ry', (-8 + x * 12).toFixed(2) + 'deg'); });
    wrap.addEventListener('pointerleave', function () { track.style.removeProperty('--rx'); track.style.removeProperty('--ry'); });
  }

  // footer: cards tilt and catch a light under the pointer; wordmark letters lift near it
  if (!still) {
    $$('[data-tilt]').forEach(function (c) {
      c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; c.style.setProperty('--rx', ((.5 - y) * 10).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((x - .5) * 12).toFixed(2) + 'deg'); c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%'); });
      c.addEventListener('pointerleave', function () { ['--rx', '--ry', '--mx', '--my'].forEach(function (p) { c.style.removeProperty(p); }); });
    });
    var mark = $('[data-mark]');
    if (mark) {
      var letters = $$('span', mark);
      mark.addEventListener('pointermove', function (e) {
        letters.forEach(function (l) { var r = l.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)) / r.width; l.style.setProperty('--lift', Math.max(0, 1 - d / 1.6).toFixed(3)); });
      });
      mark.addEventListener('pointerleave', function () { letters.forEach(function (l) { l.style.removeProperty('--lift'); }); });
    }
  }

  // prefill the quote form's service from any link that names one
  $$('[data-svc]').forEach(function (a) {
    a.addEventListener('click', function () { var s = $('#q-svc'); if (!s) { try { sessionStorage.setItem('svc', a.dataset.svc); } catch (e) {} return; } [].slice.call(s.options).forEach(function (o) { if (o.value === a.dataset.svc) s.value = o.value; }); });
  });
  try { var pending = sessionStorage.getItem('svc'), sel = $('#q-svc'); if (pending && sel) { [].slice.call(sel.options).forEach(function (o) { if (o.value === pending) sel.value = o.value; }); sessionStorage.removeItem('svc'); } } catch (e) {}

  // Forms post nowhere until data-endpoint is set; until then they say so instead of faking a success.
  var T = document.documentElement.lang === 'hi' ? {
    notConnected: 'कुछ भी नहीं भेजा गया: यह फ़ॉर्म अभी जुड़ा नहीं है। कृपया +91 90019 65072 पर कॉल या WhatsApp करें।',
    failed: 'यह नहीं हो पाया। कृपया दोबारा कोशिश करें, या +91 90019 65072 पर कॉल करें।',
    editing: 'पेज एडिट करते समय फ़ॉर्म बंद रहते हैं।', fill: 'कृपया भरें: ',
    thanks: function (n) { return 'धन्यवाद, ' + n + '। हमारी टीम एक कार्य-दिवस के भीतर परामर्श और कोटेशन के लिए आपको कॉल करेगी।'; },
    badEmail: 'कृपया सही ईमेल पता लिखें।', subscribed: function (v) { return 'सब्सक्राइब करने के लिए धन्यवाद। अपडेट ' + v + ' पर आएँगे।'; }
  } : {
    notConnected: 'Nothing was sent: this form is not connected yet. Please call or WhatsApp +91 90019 65072.',
    failed: 'That did not go through. Please try again, or call +91 90019 65072.',
    editing: 'Forms are switched off while you edit the page.', fill: 'Please fill in: ',
    thanks: function (n) { return 'Thank you, ' + n + '. Our team will call you within one working day with a consultation and quote.'; },
    badEmail: 'Please enter a valid email address.', subscribed: function (v) { return 'Thanks for subscribing. Updates will reach ' + v + '.'; }
  };
  function send(f, onOk, onFail) {
    if (editing) { onFail(T.editing); return; }
    if (!f.dataset.endpoint) { onFail(T.notConnected); return; }
    fetch(f.dataset.endpoint, { method: 'POST', body: new FormData(f) }).then(function (r) { r.ok ? onOk() : onFail(T.failed); }).catch(function () { onFail(T.failed); });
  }
  var qf = $('#quoteForm');
  if (qf) {
    var ok = $('#quoteOk'), err = $('#quoteErr');
    qf.addEventListener('submit', function (e) {
      e.preventDefault(); err.textContent = ''; ok.classList.remove('show');
      var missing = $$('[required]', qf).filter(function (x) { x.removeAttribute('aria-invalid'); return !x.value.trim(); });
      missing.forEach(function (x) { x.setAttribute('aria-invalid', 'true'); });
      if (missing.length) { err.textContent = T.fill + missing.map(function (x) { return $('label[for="' + x.id + '"]', qf).textContent; }).join(', ') + '.'; missing[0].focus(); return; }
      var name = ($('[name="name"]', qf).value || '').trim().split(' ')[0];
      send(qf, function () { ok.textContent = T.thanks(name); ok.classList.add('show'); qf.reset(); }, function (m) { err.textContent = m; });
    });
  }
  var nf = $('#newsForm');
  if (nf) {
    nf.addEventListener('submit', function (e) {
      e.preventDefault(); var v = $('#n-email').value.trim(), m = $('#newsMsg');
      if (!/.+@.+\..+/.test(v)) { m.textContent = T.badEmail; return; }
      send(nf, function () { m.textContent = T.subscribed(v); }, function (t) { m.textContent = t; });
    });
  }

  // dark mode: the head script already applied the stored or system theme; this flips and remembers it
  var root = document.documentElement;
  $$('[data-theme-toggle]').forEach(function (b) {
    var sync = function () { b.setAttribute('aria-pressed', root.dataset.theme === 'dark'); };
    sync();
    b.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
      sync();
    });
  });

  // the "available in Hindi" bar: closing it keeps it closed for a year
  var hint = $('[data-lang-hint]'), close = $('[data-lang-hint-close]');
  if (hint && close) close.addEventListener('click', function () { hint.hidden = true; document.cookie = 'lang_hint=0; path=/; max-age=31536000; samesite=lax'; });
})();
