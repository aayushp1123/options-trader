import { dataRequest } from "./client";
import type { Bar } from "./types";

/** Alpaca's own timeframe strings -- "15Min", "1Hour" are directly supported.
 * There's no reliably-documented "4Hour" stock bar timeframe, so 4-hour bars
 * are built by resampling 1Hour bars (resampleTo4Hour below) instead of
 * trusting an undocumented API param. */
export type StockTimeframe = "15Min" | "1Hour";

export async function getStockBars(symbol: string, timeframe: StockTimeframe, limit: number): Promise<Bar[]> {
  const res = await dataRequest<{ bars: Record<string, Bar[]> }>(
    `/v2/stocks/bars?symbols=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}&feed=iex&adjustment=raw`
  );
  return res.bars[symbol] ?? [];
}

export async function getCryptoBars(symbol: string, timeframe: "1Hour", limit: number): Promise<Bar[]> {
  const res = await dataRequest<{ bars: Record<string, Bar[]> }>(
    `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`
  );
  return res.bars[symbol] ?? [];
}

/** Aggregates consecutive 1-hour bars into 4-hour bars. Assumes `hourly` is
 * sorted oldest-first and drops a trailing partial group (fewer than 4
 * bars), so every returned bar represents a complete 4h window. */
export function resampleTo4Hour(hourly: Bar[]): Bar[] {
  const complete = hourly.length - (hourly.length % 4);
  const bars: Bar[] = [];
  for (let i = 0; i < complete; i += 4) {
    const group = hourly.slice(i, i + 4);
    bars.push({
      t: group[0].t,
      o: group[0].o,
      h: Math.max(...group.map((b) => b.h)),
      l: Math.min(...group.map((b) => b.l)),
      c: group[group.length - 1].c,
      v: group.reduce((sum, b) => sum + b.v, 0),
    });
  }
  return bars;
}
