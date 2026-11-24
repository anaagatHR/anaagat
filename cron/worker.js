// Tiny scheduled Worker: every morning it asks the site to write the day's blog draft.
// Pages Functions cannot run on a schedule, so this Worker holds the clock and the site holds the logic.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.SITE_URL}/api/generate`, { method: 'POST', headers: { authorization: `Bearer ${env.CRON_SECRET}` } })
        .then(async (r) => console.log('blog draft', r.status, await r.text()))
    );
  },
};
