# Roadmap: subdomains and the client CRM

anaagathr.com runs on Cloudflare, so every subdomain is a free DNS record plus a Pages project or a Worker. This is the plan for growing from one website to a small set of connected apps, in the order we expect to need them.

## The map

| Subdomain | What it is | Built with | When |
| --- | --- | --- | --- |
| `anaagathr.com` | Public website (English + `/hi/` Hindi), blog, legal pages | Pages project `anaagat` (this repo) | **Live** |
| `www.anaagathr.com` | Redirect to `anaagathr.com` | Cloudflare redirect rule | **Now** (with the domain) |
| `auth.anaagathr.com` | One sign-in for every Anaagat app (staff and, later, clients) | Worker, moved out of `functions/auth/` | **Next**: when the CRM starts |
| `crm.anaagathr.com` | Client portal for payroll clients (see below) | Separate Pages project + D1 + private R2 | **Later**: scope to be decided |
| `admin.anaagathr.com` | Staff tools: site editor, blog queue, CRM back office | Today this is `/admin` on the website | **Later**: move when the CRM back office grows |
| `media.anaagathr.com` | Public images (editor uploads, blog images) served straight from R2 | R2 custom domain | **Optional**: when traffic grows |
| `api.anaagathr.com` | Shared API for the website forms, CRM and integrations | Worker | **Later**: once two apps need the same data |

## How a new subdomain is added (10 minutes)

1. Create the app: a new Pages project (static site + Functions) or a Worker.
2. Pages project > Custom domains > add `crm.anaagathr.com`. Cloudflare creates the DNS record and the TLS certificate itself.
3. If the app needs sign-in, add its callback URL to the Google OAuth client: `https://crm.anaagathr.com/auth/callback` (or let `auth.` handle it, below).
4. Give it its own secrets. Never reuse `SESSION_SECRET` across unrelated apps unless they are meant to share sign-in.

## Shared sign-in across subdomains

Ready now. Set `COOKIE_DOMAIN=.anaagathr.com` on every app that should share the login and give them the same `SESSION_SECRET`. A staff member who signs in once is then signed in on `anaagathr.com`, `admin.` and `crm.` alike. Leave it unset (today's setting) to keep the session on one host.

When `auth.anaagathr.com` is built:
- move `functions/auth/` and `lib/session.js` into it;
- every app sends people to `https://auth.anaagathr.com/?next=<url>`;
- `auth.` signs them in with Google (staff) or an email one-time code (clients), sets the shared cookie, and sends them back to an allowed `next` (only `*.anaagathr.com`).
- Roles go into the session: `staff`, `client:<company-id>`, later `admin`.

## The client CRM (`crm.anaagathr.com`): to be decided

A first shape to react to, for clients who outsource payroll to Anaagat:

- **Client sign-in** through `auth.`, one company per login, several users per company.
- **Payroll**: monthly payroll register, payslips per employee (PDF), salary and deduction summaries.
- **Compliance**: PF, ESIC, PT, LWF challans and returns by month, with proof of filing, plus a calendar of due dates.
- **Requests**: raise a query or a new hiring or deployment request, and track its status.
- **Documents**: agreements, invoices and cost sheets.
- **Staff side** (`admin.`): upload the month's payroll files, publish them to the client, see open requests.

What it needs underneath:
- **Data:** D1 for records; a **private** R2 bucket for payslips and challans, only reachable through short-lived signed links.
- **Data protection:** every file and row is scoped to a company, checked on every request. Downloads are logged in an audit trail. Retention periods follow the privacy policy and the DPDP Act, 2023.
- **Access:** Cloudflare Access in front of `admin.` as a second lock for staff.
- **Product decisions to make first:** which payroll software the files come from (its export format decides the import), whether clients' employees also log in (to see their own payslip), and the billing model.

## Website follow-ups

- **Hindi:** the home and blog pages are in Hindi. Next would be the privacy and terms pages (after legal review) and Hindi blog posts. The AI writer can produce a Hindi version of each draft for review.
- **Forms:** connect the quote and newsletter forms (to a CRM inbox, an email service, or a D1 table on `api.`).
- **Analytics:** Cloudflare Web Analytics needs no cookies, so the privacy policy stays accurate.
