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

/** Called every 15 minutes by the GitHub Actions workflow
 * (.github/workflows/trading-bot.yml), which runs on GitHub's own
 * infrastructure at zero cost regardless of this site's own hosting bill.
 * A Netlify Scheduled Function was tried as a second, redundant scheduler
 * but removed after it (and the many redeploys during a live debugging
 * session) burned through 50% of the month's 300-credit free-tier
 * allowance in the first two days -- Netlify's free plan has no grace
 * period at 100%, the whole site (including this route) goes offline until
 * the next billing cycle, which would be a far worse outage than GitHub's
 * occasional multi-hour scheduling gaps. */
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
