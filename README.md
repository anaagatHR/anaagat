# anaagat

Website for Anaagat Humanpower ([anaagathr.com](https://anaagathr.com)), hosted on Cloudflare Pages.

- **Site**: static HTML/CSS in `public/` (home, blog, privacy, terms, 404), with one shared header and footer in `public/partials/`.
- **No-code editor**: staff sign in with Google, open any page with `?edit=1`, click text, links or pictures, and save. Edits go live in about a minute, without a rebuild.
- **Daily blog**: every morning an AI writes a draft from that day's news (with source links). A person publishes it from the dashboard. Nothing goes live on its own.

## How it fits together

| Piece | Where | Cloudflare product |
| --- | --- | --- |
| Pages, styles, images | `public/` | Pages (static) |
| Header/footer stitching, saved edits, sign-in gate | `functions/_middleware.js` | Pages Functions |
| Google sign-in | `functions/auth/` | Pages Functions |
| Editor API, image upload, blog API | `functions/api/`, `functions/media/` | Functions + KV (`CONTENT`), R2 (`MEDIA`), D1 (`DB`) |
| Blog pages and sitemap | `functions/blog/`, `functions/sitemap.xml.js` | Functions + D1 |
| Daily draft trigger (8:00 am IST) | `cron/` | a separate Worker with a cron trigger |
| Shared logic | `lib/` | — |

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars      # fill in at least SESSION_SECRET
npm run db:local                    # create the blog table in the local D1
npm run dev                         # http://localhost:8788
npm test                            # unit tests (sanitizer, sessions, sign-in rules, RSS, edit keys)
```

## Deploy to Cloudflare (one time)

1. **Create the storage** (logged in with `npx wrangler login`):
   ```bash
   npx wrangler kv namespace create CONTENT      # copy the id into wrangler.toml
   npx wrangler d1 create anaagat                # copy the database_id into wrangler.toml
   npx wrangler r2 bucket create anaagat-media
   npm run db:remote                             # create the blog table
   ```
2. **Create the Pages project**: Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git > `anaagatHR/anaagat`.
   Framework preset: *None*. Build command: `npm ci`. Build output directory: `public`.
   The KV, D1 and R2 bindings are read from `wrangler.toml`.
3. **Add the secrets** (Pages project > Settings > Variables and Secrets), using `.dev.vars.example` as the list:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_DOMAINS`, `ADMIN_EMAILS` (optional), `SESSION_SECRET`, `CRON_SECRET`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` (optional).
4. **Google sign-in**: Google Cloud Console > APIs & Services > Credentials > *Create OAuth client ID* > Web application.
   Authorised redirect URI: `https://anaagathr.com/auth/callback`. Set the consent screen to *Internal* if you use Google Workspace.
   `ALLOWED_DOMAINS` is your Workspace domain (every account on it can sign in). Put individual extra addresses in `ADMIN_EMAILS`.
5. **Custom domain**: Pages project > Custom domains > add `anaagathr.com` (and `www.anaagathr.com`).
6. **Daily blog trigger**:
   ```bash
   cd cron
   npx wrangler deploy
   npx wrangler secret put CRON_SECRET          # the same value as on the Pages project
   ```

## The blog AI

- **Default**: Claude via the Anthropic API (`AI_PROVIDER=anthropic`, `AI_API_KEY=<key>`). The model defaults to `claude-opus-5-5`. One post a day costs a few cents. Set `AI_MODEL=claude-haiku-5-5` for the cheapest option.
- **Your own server later**: set `AI_PROVIDER=custom`, `AI_BASE_URL=https://your-server/v1` and `AI_MODEL=<name>`. Any OpenAI-compatible `/chat/completions` server works (vLLM, Ollama, LM Studio). `AI_API_KEY` becomes an optional bearer token. No code change is needed.
- **Guardrails**:
  - The AI only gets that day's news items (Google News RSS per topic, or your own `BLOG_FEEDS`).
  - It is told to use only facts in them and to link each one.
  - Its HTML is sanitised.
  - Every post lists its sources.
  - Drafts wait for a human to publish them.

## Editing the website

Sign in at `/admin/login`, then use the dashboard links, or press *Edit this page* on any page.

- **Text:** click and type. Ctrl+B for bold. Enter finishes editing.
- **Links:** click one to change its address.
- **Pictures:** click one to upload a replacement (JPG, PNG, WebP, GIF or AVIF, up to 5 MB) and set its description.
- **Saving:** press Save, or Ctrl+S. The previous version is kept in KV for 30 days (`history:` keys).

Adding new markup? Run `npm run keys` so new text gets an edit key. Existing keys never change.

## Languages, dark mode, icons

- **Hindi**: `public/hi/` holds the Hindi home and blog pages, and `public/partials/*-hi.html` the Hindi header and footer. Every page shows a gold *हिंदी में पढ़ें* button. Visitors whose browser asks for Hindi also see a one-line bar offering the Hindi site. Hindi text is edited with the same no-code editor (open `/hi/?edit=1`). If you change the English page's structure, mirror it in the Hindi page.
- **Dark mode**: the moon/sun button in the header. The first visit follows the device setting, and the choice is remembered in the visitor's browser.
- **Icons**: `public/favicon.ico` (16 to 64 px), plus `assets/icon-192.png`, `assets/icon-512.png` and `assets/apple-touch-icon.png`.

## Sitemap and Google Search Console

`/sitemap.xml` is generated on request. It lists the English/Hindi pairs and every published blog post, so a new post appears in it within 10 minutes. Every Monday at 8:30 am IST the cron Worker resubmits it to Search Console. To switch that on:

1. Search Console > add a **Domain** property `anaagathr.com` and verify it with the DNS TXT record (Cloudflare DNS).
2. Google Cloud Console > IAM > Service accounts > create one, then *Keys* > *Add key* > JSON. Enable the "Google Search Console API" for the project.
3. Search Console > Settings > Users and permissions > add the service account's email as **Owner**.
4. `cd cron && npx wrangler secret put GSC_CLIENT_EMAIL` (the `client_email` from the JSON) and `npx wrangler secret put GSC_PRIVATE_KEY` (the `private_key`), then `npx wrangler deploy`.

Google still decides how often it crawls. The weekly submission keeps the sitemap fresh in Search Console and surfaces errors there.

## Future plans

Subdomains (`auth.`, `crm.`, `admin.`, `media.`, `api.`) and the client CRM are planned in [docs/ROADMAP.md](docs/ROADMAP.md).

## Still to provide

- The four company figures on the home page (shown as "add figure" slots until edited in).
- The grievance officer's name and email on `/privacy`.
- A legal review of `/privacy` and `/terms`.
- Real social media links, if you want them in the footer.
- Connecting the quote and newsletter forms to an inbox or CRM. Until then they tell visitors that nothing was sent and to call or WhatsApp instead.
