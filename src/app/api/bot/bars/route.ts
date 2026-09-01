import { NextResponse } from "next/server";
import { isAlpacaConfigured } from "@/lib/alpaca/client";
import { getCryptoBars, getStockBars } from "@/lib/alpaca/marketData";
import { getSampleMarkSeries } from "@/lib/sampleData";
import type { MarkPricePoint } from "@/lib/types";

/** Backs the position-detail modal's mark-price chart. Client-side (the
 * modal can't hold Alpaca credentials), so it goes through this route
 * instead of calling the Alpaca client directly. */
export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  if (!isAlpacaConfigured()) {
    return NextResponse.json({ points: getSampleMarkSeries(symbol), live: false });
  }

  try {
    const isCrypto = symbol === "BTCUSD";
    const bars = isCrypto ? await getCryptoBars("BTC/USD", "1Hour", 90) : await getStockBars(symbol, "15Min", 90);
    const points: MarkPricePoint[] = bars.map((b) => ({ date: b.t, value: b.c }));
    return NextResponse.json({ points, live: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
