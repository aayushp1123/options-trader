import { NextResponse } from "next/server";
import { isAlpacaConfigured } from "@/lib/alpaca/client";
import { runTick } from "@/lib/bot/runner";

export const maxDuration = 60;

/** Called by the GitHub Actions scheduled workflow every 15 minutes (see
 * .github/workflows/trading-bot.yml). Vercel's own Cron feature isn't used
 * here -- Hobby plan cron is capped at once/day, far too coarse for a
 * 15-minute strategy, so an external scheduler hits this route instead. */
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
