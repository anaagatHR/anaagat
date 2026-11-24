// Scheduled Worker. Pages Functions cannot run on a schedule, so this Worker holds the clock:
//  - every day, 8:00 am IST: ask the site to write the day's blog draft
//  - every Monday, 8:30 am IST: resubmit sitemap.xml to Google Search Console
import { submitSitemap } from './gsc.js';

export const DAILY = '30 2 * * *';
export const WEEKLY = '0 3 * * 1';

export default {
  async scheduled(event, env, ctx) {
    if (event.cron === WEEKLY) {
      ctx.waitUntil(submitSitemap(env).then((msg) => console.log(msg)));
      return;
    }
    ctx.waitUntil(
      fetch(`${env.SITE_URL}/api/generate`, { method: 'POST', headers: { authorization: `Bearer ${env.CRON_SECRET}` } })
        .then(async (r) => console.log('blog draft', r.status, await r.text()))
    );
  },
};
