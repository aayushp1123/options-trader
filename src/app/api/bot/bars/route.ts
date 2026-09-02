import { NextResponse } from "next/server";
import { isAlpacaConfigured } from "@/lib/alpaca/client";
import { getCryptoBars, getStockBars } from "@/lib/alpaca/marketData";
import { getSampleMarkSeries } from "@/lib/sampleData";
import type { MarkPricePoint } from "@/lib/types";
import type { OhlcPoint } from "@/components/PremiumChart";

/** Backs the position-detail modal's mark-price chart (and the "compare
 * with another symbol" overlay, which just calls this same route with a
 * different symbol). Client-side (the modal can't hold Alpaca credentials),
 * so it goes through this route instead of calling the Alpaca client
 * directly. */
export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  if (!isAlpacaConfigured()) {
    return NextResponse.json({ points: getSampleMarkSeries(symbol), ohlc: [], live: false });
  }

  try {
    const isCrypto = symbol.toUpperCase() === "BTCUSD" || symbol.toUpperCase() === "BTC/USD";
    const bars = isCrypto
      ? await getCryptoBars("BTC/USD", "1Hour", 90)
      : await getStockBars(symbol.toUpperCase(), "15Min", 90);
    const points: MarkPricePoint[] = bars.map((b) => ({ date: b.t, value: b.c }));
    const ohlc: OhlcPoint[] = bars.map((b) => ({ date: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
    return NextResponse.json({ points, ohlc, live: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
