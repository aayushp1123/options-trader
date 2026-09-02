import { dataRequest } from "./client";
import type { Bar } from "./types";

/** Alpaca's own timeframe strings -- "15Min", "1Hour" are directly supported.
 * There's no reliably-documented "4Hour" stock bar timeframe, so 4-hour bars
 * are built by resampling 1Hour bars (resampleTo4Hour below) instead of
 * trusting an undocumented API param. */
export type StockTimeframe = "15Min" | "1Hour";

const TIMEFRAME_MINUTES: Record<string, number> = { "15Min": 15, "1Hour": 60 };

/** Alpaca's bars endpoints don't reliably backfill far enough using `limit`
 * alone -- observed live: the crypto endpoint defaulted to only today's
 * single bar when `start` was omitted, even with limit=120. An explicit
 * `start`, computed generously backward from how much history `limit`
 * actually needs, fixes it for both endpoints. `continuous` controls
 * whether the lookback assumes 24/7 trading (crypto) or ~6.5h/weekday
 * equity market hours (stocks). */
function computeStartISO(timeframe: string, limit: number, continuous: boolean): string {
  const neededMinutes = (TIMEFRAME_MINUTES[timeframe] ?? 60) * limit;
  const calendarDays = continuous
    ? Math.ceil(neededMinutes / 1440) + 3
    : Math.ceil(neededMinutes / 390) * 2 + 10; // trading day ~= 390min; pad for weekends/holidays
  return new Date(Date.now() - calendarDays * 86400000).toISOString();
}

export async function getStockBars(symbol: string, timeframe: StockTimeframe, limit: number): Promise<Bar[]> {
  const start = computeStartISO(timeframe, limit, false);
  const res = await dataRequest<{ bars: Record<string, Bar[]> }>(
    `/v2/stocks/bars?symbols=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}&start=${start}&feed=iex&adjustment=raw`
  );
  return res.bars[symbol] ?? [];
}

export async function getCryptoBars(symbol: string, timeframe: "1Hour", limit: number): Promise<Bar[]> {
  const start = computeStartISO(timeframe, limit, true);
  const res = await dataRequest<{ bars: Record<string, Bar[]> }>(
    `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}&start=${start}`
  );
  return res.bars[symbol] ?? [];
}

/** Fetches every bar in [startISO, now) for backtesting, paging through
 * Alpaca's next_page_token since a multi-month range can exceed what a
 * single request returns -- distinct from getStockBars/getCryptoBars above,
 * which are tuned for the live bot's small rolling window and don't need
 * pagination. */
export async function getStockBarsRange(symbol: string, timeframe: StockTimeframe, startISO: string): Promise<Bar[]> {
  const all: Bar[] = [];
  let pageToken: string | null = null;
  do {
    const tokenParam: string = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "";
    const res: { bars: Record<string, Bar[]>; next_page_token: string | null } = await dataRequest(
      `/v2/stocks/bars?symbols=${encodeURIComponent(symbol)}&timeframe=${timeframe}&start=${startISO}&limit=10000&feed=iex&adjustment=raw${tokenParam}`
    );
    all.push(...(res.bars[symbol] ?? []));
    pageToken = res.next_page_token;
  } while (pageToken);
  return all;
}

export async function getCryptoBarsRange(symbol: string, timeframe: "1Hour", startISO: string): Promise<Bar[]> {
  const all: Bar[] = [];
  let pageToken: string | null = null;
  do {
    const tokenParam: string = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "";
    const res: { bars: Record<string, Bar[]>; next_page_token: string | null } = await dataRequest(
      `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(symbol)}&timeframe=${timeframe}&start=${startISO}&limit=10000${tokenParam}`
    );
    all.push(...(res.bars[symbol] ?? []));
    pageToken = res.next_page_token;
  } while (pageToken);
  return all;
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
