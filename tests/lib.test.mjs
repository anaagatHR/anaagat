// Run: npm test   (node --test, no extra packages)
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanInline, cleanArticle, safeUrl } from '../lib/sanitize.js';
import { sign, verify, isAllowed } from '../lib/session.js';
import { parseRss, topicFor, TOPICS } from '../lib/feeds.js';
import { pagePath } from '../lib/content.js';
import { parsePost } from '../lib/ai.js';
import { slugify } from '../lib/blog.js';
import { addKeys, simpleInner } from '../tools/add-edit-keys.mjs';

test('sanitizer keeps formatting and strips everything dangerous', () => {
  assert.equal(cleanInline('Hi <b onclick="x()">there</b><script>alert(1)</script>'), 'Hi <b>there</b>');
  assert.equal(cleanInline('<img src=x onerror=alert(1)>ok'), 'ok');
  assert.equal(cleanInline('a<span class="visually-hidden"> (new tab)</span>'), 'a<span class="visually-hidden"> (new tab)</span>');
  assert.equal(cleanArticle('<a href="javascript:alert(1)">x</a>'), '<a>x</a>');
  assert.equal(cleanArticle('<a href="https://ex.com/a">x</a>'), '<a href="https://ex.com/a" target="_blank" rel="noopener noreferrer">x</a>');
  assert.equal(cleanArticle('<h2 style="color:red">T</h2><iframe src="x"></iframe>'), '<h2>T</h2>');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('tel:+919001965072'), 'tel:+919001965072');
});

test('session tokens verify, and tampered or expired ones do not', async () => {
  const t = await sign({ email: 'a@x.com', exp: Date.now() + 60000 }, 'secret');
  assert.equal((await verify(t, 'secret')).email, 'a@x.com');
  assert.equal(await verify(t, 'other-secret'), null);
  assert.equal(await verify(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 'secret'), null);
  assert.equal(await verify(await sign({ email: 'a@x.com', exp: Date.now() - 1 }, 'secret'), 'secret'), null);
});

test('sign-in allows the company domain and listed emails only', () => {
  const env = { ALLOWED_DOMAINS: 'anaagathr.com', ADMIN_EMAILS: 'owner@gmail.com' };
  assert.equal(isAllowed({ email: 'hr@anaagathr.com', hd: 'anaagathr.com', email_verified: true }, env), true);
  assert.equal(isAllowed({ email: 'owner@gmail.com', email_verified: true }, env), true);
  assert.equal(isAllowed({ email: 'someone@gmail.com', email_verified: true }, env), false);
  assert.equal(isAllowed({ email: 'x@anaagathr.com.evil.com', hd: 'anaagathr.com.evil.com', email_verified: true }, env), false);
  assert.equal(isAllowed({ email: 'hr@anaagathr.com', hd: 'anaagathr.com', email_verified: false }, env), false);
});

test('rss parsing, topics, paths, slugs and AI replies', () => {
  const xml = '<rss><channel><item><title><![CDATA[Hiring rises &amp; more]]></title><link>https://news.example/a</link><pubDate>Mon, 24 Nov 2026</pubDate><source url="https://x">Example News</source></item><item><title>No link</title></item></channel></rss>';
  assert.deepEqual(parseRss(xml).map((i) => [i.title, i.link, i.source]), [['Hiring rises & more', 'https://news.example/a', 'Example News']]);
  assert.ok(TOPICS.includes(topicFor(new Date('2026-11-25'))));
  assert.equal(pagePath('/index.html'), '/');
  assert.equal(pagePath('/privacy.html'), '/privacy');
  assert.equal(pagePath('/blog/'), '/blog');
  assert.equal(slugify('PF & ESIC: What changes in 2026?'), 'pf-esic-what-changes-in-2026');
  assert.equal(parsePost('```json\n{"title":"T","summary":"S","tags":["A"],"body_html":"<p>x</p>"}\n```').tags[0], 'a');
  assert.throws(() => parsePost('{"title":""}'));
});

test('Search Console: the service-account JWT verifies with the matching public key, and the submit call is well formed', async () => {
  const { serviceAccountAssertion, submitSitemap } = await import('../cron/gsc.js');
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\\n${der.match(/.{1,64}/g).join('\\n')}\\n-----END PRIVATE KEY-----\\n`; // as pasted into an env var
  const jwt = await serviceAccountAssertion('sa@p.iam.gserviceaccount.com', pem, 'scope-x', 1000);
  const [h, p, s] = jwt.split('.');
  const dec = (x) => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  assert.deepEqual(JSON.parse(dec(p)), { iss: 'sa@p.iam.gserviceaccount.com', scope: 'scope-x', aud: 'https://oauth2.googleapis.com/token', iat: 1000, exp: 4600 });
  assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, dec(s), new TextEncoder().encode(`${h}.${p}`)), true);

  const calls = [];
  const fake = async (url, opts) => { calls.push([url, opts.method]); return url.includes('oauth2') ? new Response(JSON.stringify({ access_token: 't' })) : new Response(null, { status: 204 }); };
  const msg = await submitSitemap({ GSC_CLIENT_EMAIL: 'sa@p.iam.gserviceaccount.com', GSC_PRIVATE_KEY: pem, SITE_URL: 'https://anaagathr.com' }, fake);
  assert.equal(msg, 'sitemap submit 204');
  assert.deepEqual(calls[1], ['https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aanaagathr.com/sitemaps/https%3A%2F%2Fanaagathr.com%2Fsitemap.xml', 'PUT']);
  assert.match(await submitSitemap({}), /^skipped/);
});

test('edit keys go on text and images, never nested, and are stable on re-run', () => {
  assert.equal(simpleInner('Hello <b>you</b>'), true);
  assert.equal(simpleInner('<span class="tile"><svg></svg></span>Manufacturing'), false);
  const src = '<ul><li><a href="/x">Go</a></li><li>Plain</li></ul><p>Text <b>bold</b></p><img src="a.jpg" alt="">';
  const once = addKeys(src, 'pg').html;
  assert.match(once, /<a href="\/x" data-edit="pg\.a\d+">/);
  assert.match(once, /<li data-edit="pg\.li\d+">Plain/);
  assert.match(once, /<p data-edit="pg\.p\d+">/);
  assert.doesNotMatch(once, /<b data-edit/);
  assert.match(once, /<img src="a\.jpg" alt="" data-edit-src="pg\.img\d+">/);
  assert.equal(addKeys(once, 'pg').added, 0);
});
