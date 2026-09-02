/**
 * Second, redundant scheduler for /api/bot/tick, running on Netlify's own
 * Scheduled Functions (free tier, no card, already-authenticated project --
 * zero new signup). Added because GitHub Actions' free-tier schedule proved
 * to fire far less often than its declared every-15-minutes cron (observed
 * gaps of 1-4.5 hours in practice, not ~15 minutes). Runs alongside the GitHub
 * Actions workflow rather than replacing it -- the tick endpoint is
 * idempotent (checks real Alpaca positions before acting), so two
 * schedulers hitting it is harmless, and this gives a second, independently
 * throttled path in case either platform's cron degrades.
 */
async function scheduledTick() {
  const secret = process.env.BOT_SECRET;
  if (!secret) {
    console.error("[scheduled-tick] BOT_SECRET not configured");
    return;
  }
  const res = await fetch("https://options-desk-bot.netlify.app/api/bot/tick", {
    method: "POST",
    headers: { "x-bot-secret": secret },
  });
  const body = await res.text();
  console.log(`[scheduled-tick] status=${res.status} body=${body}`);
}

export default scheduledTick;

export const config = {
  schedule: "*/15 * * * *",
};
