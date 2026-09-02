import { getCryptoBars, getStockBars, resampleTo4Hour } from "@/lib/alpaca/marketData";
import {
  cancelOpenOrdersForSymbol,
  closePosition,
  getAccount,
  getAsset,
  getClock,
  getPositions,
  placeProtectedEntry,
} from "@/lib/alpaca/trading";
import type { Bar, Position } from "@/lib/alpaca/types";
import { blockedByCorrelation } from "@/lib/risk/correlationFilter";
import { sizePosition } from "@/lib/risk/positionSizing";
import { MARKETS, type MarketConfig } from "./markets";

export interface TickResult {
  symbol: string;
  strategy: string;
  action:
    | "opened"
    | "closed"
    | "skipped_market_closed"
    | "skipped_correlation"
    | "skipped_not_shortable"
    | "skipped_insufficient_data"
    | "skipped_error"
    | "held"
    | "no_signal";
  detail: string;
}

const BARS_NEEDED = 120; // enough for a 50-period EMA/ADX with warmup room

export async function fetchBars(market: MarketConfig): Promise<Bar[]> {
  if (market.assetClass === "crypto") {
    return getCryptoBars(market.symbol, "1Hour", BARS_NEEDED);
  }
  if (market.strategyLabel === "trend-following-4h") {
    // Fetch 4x the hourly bars needed since 4 hourly bars resample into 1.
    const hourly = await getStockBars(market.symbol, "1Hour", BARS_NEEDED * 4);
    return resampleTo4Hour(hourly);
  }
  return getStockBars(market.symbol, "15Min", BARS_NEEDED);
}

export async function runTick(): Promise<TickResult[]> {
  const [account, openPositions, clock] = await Promise.all([getAccount(), getPositions(), getClock()]);
  const equity = parseFloat(account.equity);
  const results: TickResult[] = [];

  for (const market of MARKETS) {
    if (market.assetClass === "us_equity" && !clock.is_open) {
      results.push({ symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_market_closed", detail: "equity market closed" });
      continue;
    }

    let bars: Bar[];
    try {
      bars = await fetchBars(market);
    } catch (err) {
      results.push({ symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_insufficient_data", detail: `bars fetch failed: ${(err as Error).message}` });
      continue;
    }

    const existing = openPositions.find((p) => p.symbol === market.symbol.replace("/", ""));
    try {
      results.push(await evaluateMarket(market, bars, existing, equity, openPositions));
    } catch (err) {
      // One market's order/API failure must never take down the other 4 --
      // confirmed live: an uncaught error here previously 500'd the whole
      // tick, so markets after the failing one in MARKETS never even got
      // evaluated that run.
      results.push({ symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_error", detail: (err as Error).message });
    }
  }

  return results;
}

async function evaluateMarket(
  market: MarketConfig,
  bars: Bar[],
  existing: Position | undefined,
  equity: number,
  openPositions: Position[]
): Promise<TickResult> {
  if (existing) {
    const exit = market.getExit(bars, existing.side);
    if (exit.shouldExit) {
      await closePosition(existing.symbol);
      // The crypto protective stop is a separate order, not a linked child
      // leg, so closing the position doesn't cancel it on its own -- do
      // that explicitly so a stale stop can't fill later against a
      // position that no longer exists. Applied to every exit, not just
      // crypto, as a cheap general safety net.
      await cancelOpenOrdersForSymbol(existing.symbol).catch(() => {});
      return { symbol: market.symbol, strategy: market.strategyLabel, action: "closed", detail: exit.reason };
    }
    return { symbol: market.symbol, strategy: market.strategyLabel, action: "held", detail: exit.reason };
  }

  const signal = market.getSignal(bars);
  if (!signal) {
    return { symbol: market.symbol, strategy: market.strategyLabel, action: "no_signal", detail: "no entry condition met" };
  }

  if (blockedByCorrelation(market.symbol, signal.side, openPositions)) {
    return { symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_correlation", detail: "Nasdaq/S&P already long, skipping to avoid doubled exposure" };
  }

  if (signal.side === "short" && market.assetClass === "us_equity") {
    const asset = await getAsset(market.symbol);
    if (!asset.shortable) {
      return { symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_not_shortable", detail: `${market.symbol} cannot be sold short on this account` };
    }
  }

  const sized = sizePosition({
    equity,
    entryPrice: signal.entryPrice,
    atr: signal.atr,
    side: signal.side,
    fractional: market.assetClass === "crypto",
  });
  if (sized.qty <= 0) {
    return { symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_insufficient_data", detail: "computed position size was zero" };
  }

  await placeProtectedEntry({
    symbol: market.symbol,
    side: signal.side === "long" ? "buy" : "sell",
    qty: String(sized.qty),
    stopPrice: sized.stopPrice,
    assetClass: market.assetClass,
  });

  return {
    symbol: market.symbol,
    strategy: market.strategyLabel,
    action: "opened",
    detail: `${signal.side} ${sized.qty} @ ~${signal.entryPrice.toFixed(2)}, stop ${sized.stopPrice.toFixed(2)} (risking $${sized.riskDollars.toFixed(2)}) -- ${signal.reason}`,
  };
}
