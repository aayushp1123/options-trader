import { tradingRequest } from "./client";
import type { Account } from "@/lib/types";
import type { Clock, Order, Position } from "./types";

export function getAccount(): Promise<Account> {
  return tradingRequest<Account>("/v2/account");
}

export function getPositions(): Promise<Position[]> {
  return tradingRequest<Position[]>("/v2/positions");
}

export function getOrders(status: "open" | "closed" | "all" = "all", limit = 100): Promise<Order[]> {
  return tradingRequest<Order[]>(`/v2/orders?status=${status}&limit=${limit}&direction=desc`);
}

export function getClock(): Promise<Clock> {
  return tradingRequest<Clock>("/v2/clock");
}

export interface AssetInfo {
  symbol: string;
  shortable: boolean;
  easy_to_borrow: boolean;
  tradable: boolean;
}

/** Whether shorting is actually allowed varies per equity/ETF and isn't
 * knowable in advance without asking Alpaca -- confirmed live: USO
 * rejected a short with "asset USO cannot be sold short". Checked before
 * attempting a short entry so a restricted symbol produces a clean skip
 * instead of a failed order every time the signal recurs. */
export function getAsset(symbol: string): Promise<AssetInfo> {
  return tradingRequest<AssetInfo>(`/v2/assets/${encodeURIComponent(symbol)}`);
}

export interface PortfolioHistory {
  timestamp: number[]; // unix seconds
  equity: number[];
}

export function getPortfolioHistory(): Promise<PortfolioHistory> {
  return tradingRequest<PortfolioHistory>("/v2/account/portfolio/history?period=1M&timeframe=1D");
}

export interface EntryOrderInput {
  symbol: string;
  side: "buy" | "sell";
  qty: string; // string to preserve fractional precision (crypto)
  stopPrice: number;
  assetClass: "us_equity" | "crypto";
}

export function getOrder(id: string): Promise<Order> {
  return tradingRequest<Order>(`/v2/orders/${id}`);
}

/** Places a market entry with a hard stop-loss enforced by Alpaca itself
 * (a real resting order at the broker, not application logic polling
 * afterward), so it survives the bot process not running for a tick.
 *
 * Equities use order_class "oto" (one-triggers-other, a single child leg).
 * Not "bracket": bracket orders require BOTH a stop_loss and a take_profit
 * leg (confirmed live -- Alpaca rejected a stop-only bracket with
 * `bracket orders require take_profit.limit_price`), but these strategies
 * exit on their own signal logic (mean reversion/trend reversal), not a
 * fixed profit target, so forcing a take-profit price would be wrong, not
 * just extra.
 *
 * Crypto orders don't support order_class or stop_loss at all (confirmed
 * against Alpaca's docs -- only plain market/limit/stop_limit orders exist
 * for crypto). So for crypto: place the market entry, then immediately
 * place an independent stop_limit order for the SAME requested qty as the
 * protective stop -- two orders instead of one with an attached leg.
 *
 * Deliberately does NOT wait/poll for the entry to actually fill before
 * placing the stop, even though that would give an exact filled qty:
 * Netlify's free-tier synchronous function limit is a real, hard 10
 * seconds (confirmed against their docs -- separate from and stricter than
 * this route's own `maxDuration` config, which the platform ceiling
 * overrides regardless). A polling wait risks the function getting killed
 * after the entry fills but before the stop is placed, leaving a real
 * position with no stop-loss at all -- exactly the outcome the hard-stop
 * rule exists to prevent. Firing both orders back-to-back keeps total
 * execution to two quick sequential calls, safely under that ceiling. If
 * the entry only partially fills, Alpaca simply won't execute more of the
 * stop than the position actually holds (crypto is spot/long-only, so
 * there's no way to end up net short from an oversized stop order). The
 * stop_limit leaves 1% of slippage room between stop and limit price so it
 * can still fill during a fast move instead of sitting unfilled past the
 * stop. */
export async function placeProtectedEntry(input: EntryOrderInput): Promise<Order> {
  if (input.assetClass !== "crypto") {
    return tradingRequest<Order>("/v2/orders", {
      method: "POST",
      body: JSON.stringify({
        symbol: input.symbol,
        qty: input.qty,
        side: input.side,
        type: "market",
        time_in_force: "day",
        order_class: "oto",
        stop_loss: { stop_price: input.stopPrice.toFixed(2) },
      }),
    });
  }

  const entry = await tradingRequest<Order>("/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol: input.symbol,
      qty: input.qty,
      side: input.side,
      type: "market",
      time_in_force: "gtc",
    }),
  });

  const exitSide = input.side === "buy" ? "sell" : "buy";
  const limitPrice = input.side === "buy" ? input.stopPrice * 0.99 : input.stopPrice * 1.01;

  await tradingRequest<Order>("/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol: input.symbol,
      qty: input.qty,
      side: exitSide,
      type: "stop_limit",
      time_in_force: "gtc",
      stop_price: input.stopPrice.toFixed(2),
      limit_price: limitPrice.toFixed(2),
    }),
  });

  return entry;
}

/** Market-closes an open position (used for signal-based exits, distinct
 * from the hard stop-loss which Alpaca enforces on its own). */
export function closePosition(symbol: string): Promise<Order> {
  return tradingRequest<Order>(`/v2/positions/${encodeURIComponent(symbol)}`, { method: "DELETE" });
}

/** Cancels any remaining open orders for a symbol. Required after a
 * signal-based exit on crypto specifically: the protective stop there is a
 * separate, independently-placed stop_limit order (crypto has no oto/
 * bracket support), not a formally linked child leg the way an equity's
 * stop is -- so closing the position does NOT automatically cancel it.
 * Left standing, a stale stop could later fill against a position that no
 * longer exists. Called for every exit, not just crypto, as a cheap general
 * safety net regardless of asset class. Matches on the symbol with slashes
 * stripped since order symbols and position symbols don't always agree on
 * crypto's "BTC/USD" vs "BTCUSD" formatting. */
export async function cancelOpenOrdersForSymbol(symbol: string): Promise<void> {
  const openOrders = await tradingRequest<Order[]>("/v2/orders?status=open&limit=100");
  const normalized = symbol.replace("/", "");
  const matching = openOrders.filter((o) => o.symbol.replace("/", "") === normalized);
  await Promise.all(matching.map((o) => tradingRequest<void>(`/v2/orders/${o.id}`, { method: "DELETE" })));
}
