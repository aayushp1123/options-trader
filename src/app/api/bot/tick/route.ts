import { NextResponse } from "next/server";
import { isAlpacaConfigured } from "@/lib/alpaca/client";
import { runTick } from "@/lib/bot/runner";

// This value is aspirational, not enforced: deployed on Netlify, whose
// free-tier synchronous function limit is a hard 10 seconds regardless of
// what's declared here (confirmed against their docs). runTick() and
// placeProtectedEntry() are both written to stay well under that real
// ceiling -- see the comment on placeProtectedEntry for why the crypto
// order path specifically avoids any wait/poll that could blow past it.
export const maxDuration = 60;

/** Called every 15 minutes by two independent schedulers: the GitHub
 * Actions workflow (.github/workflows/trading-bot.yml) and Netlify's own
 * Scheduled Function (netlify/functions/scheduled-tick.mts). Neither
 * platform's native Cron feature is used directly for the trading logic
 * itself -- Vercel-style "Hobby cron capped at once/day" isn't Netlify's
 * limitation, but a 15-minute strategy still needs an external trigger
 * hitting this route rather than relying on any single scheduler's
 * reliability alone. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_SECRET || secret !== process.env.BOT_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isAlpacaConfigured()) {
    return NextResponse.json({ error: "ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY not configured" }, { status: 503 });
  }

  try {
    const results = await runTick();
    return NextResponse.json({ ranAt: new Date().toISOString(), results });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
