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

async function waitForFill(orderId: string, attempts = 6, delayMs = 1000): Promise<Order> {
  for (let i = 0; i < attempts; i++) {
    const order = await getOrder(orderId);
    if (order.status === "filled") return order;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return getOrder(orderId); // give up waiting, return whatever the last real status is
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
 * for crypto). So for crypto: place the market entry, wait for it to
 * actually fill, then place an independent stop_limit order for the filled
 * qty as the protective stop -- still a real standing order at the broker,
 * just two orders instead of one order with an attached leg. The stop_limit
 * leaves 1% of slippage room between stop and limit price so it can still
 * fill during a fast move instead of sitting unfilled past the stop. */
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

  const filled = await waitForFill(entry.id);
  const filledQty = filled.filled_qty ?? input.qty;
  const exitSide = input.side === "buy" ? "sell" : "buy";
  const limitPrice = input.side === "buy" ? input.stopPrice * 0.99 : input.stopPrice * 1.01;

  await tradingRequest<Order>("/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol: input.symbol,
      qty: filledQty,
      side: exitSide,
      type: "stop_limit",
      time_in_force: "gtc",
      stop_price: input.stopPrice.toFixed(2),
      limit_price: limitPrice.toFixed(2),
    }),
  });

  return filled;
}

/** Market-closes an open position (used for signal-based exits, distinct
 * from the hard stop-loss which Alpaca enforces on its own). */
export function closePosition(symbol: string): Promise<Order> {
  return tradingRequest<Order>(`/v2/positions/${encodeURIComponent(symbol)}`, { method: "DELETE" });
}
