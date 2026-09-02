import { getCryptoBars, getStockBars, resampleTo4Hour } from "@/lib/alpaca/marketData";
import {
  cancelOpenOrdersForSymbol,
  closePosition,
  getAccount,
  getAsset,
  getClock,
  getOrders,
  getPositions,
  placeProtectedEntry,
  placeStopOrder,
} from "@/lib/alpaca/trading";
import type { Bar, Order, Position } from "@/lib/alpaca/types";
import { atr } from "@/lib/indicators";
import { blockedByCorrelation } from "@/lib/risk/correlationFilter";
import { sizePosition } from "@/lib/risk/positionSizing";
import { MARKETS, type MarketConfig } from "./markets";

export interface TickResult {
  symbol: string;
  strategy: string;
  action:
    | "opened"
    | "closed"
    | "healed_missing_stop"
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

/**
 * Verifies every open position (across all 5 managed markets) actually has
 * a resting protective stop order, and places one if it's ever missing --
 * for any reason, not just the one already found. Confirmed live: a real
 * BTC entry filled with no stop_limit order behind it. The entry order and
 * stop order are two separate sequential API calls (crypto has no
 * order_class support to make them atomic), and Netlify's hard 10-second
 * function limit can in principle cut execution off between them even
 * though placeProtectedEntry no longer waits for a fill first -- normal
 * network variance on two real external calls is enough on its own. Rather
 * than trying to guarantee that race never happens (impossible to fully
 * guarantee against real-world latency), this makes a missing stop
 * self-healing: run first, every tick, before any new signal evaluation,
 * so an unprotected position never survives more than one tick interval.
 */
async function ensureStopLossOrders(openPositions: Position[]): Promise<TickResult[]> {
  const results: TickResult[] = [];
  const openOrders = await getOrders("open", 100);

  for (const market of MARKETS) {
    const posSymbol = market.symbol.replace("/", "");
    const position = openPositions.find((p) => p.symbol === posSymbol);
    if (!position) continue;

    const hasStop = openOrders.some(
      (o: Order) => o.symbol.replace("/", "") === posSymbol && (o.type === "stop" || o.type === "stop_limit")
    );
    if (hasStop) continue;

    try {
      const bars = await fetchBars(market);
      const currentAtr = atr(bars, 14);
      if (currentAtr === null) {
        results.push({ symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_insufficient_data", detail: "position has no stop but not enough bars yet to compute one -- will retry next tick" });
        continue;
      }
      const entryPrice = parseFloat(position.avg_entry_price);
      const stopDistance = currentAtr * 1.5;
      const stopPrice = position.side === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;
      const qty = String(Math.abs(parseFloat(position.qty)));

      await placeStopOrder({ symbol: market.symbol, entrySide: position.side === "long" ? "buy" : "sell", qty, stopPrice });
      results.push({ symbol: market.symbol, strategy: market.strategyLabel, action: "healed_missing_stop", detail: `placed missing protective stop at ${stopPrice.toFixed(2)}` });
    } catch (err) {
      results.push({ symbol: market.symbol, strategy: market.strategyLabel, action: "skipped_error", detail: `failed to heal missing stop: ${(err as Error).message}` });
    }
  }

  return results;
}

export async function runTick(): Promise<TickResult[]> {
  const [account, openPositions, clock] = await Promise.all([getAccount(), getPositions(), getClock()]);
  const equity = parseFloat(account.equity);
  const results: TickResult[] = [];

  results.push(...(await ensureStopLossOrders(openPositions)));

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
