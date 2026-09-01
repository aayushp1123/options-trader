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

export interface PortfolioHistory {
  timestamp: number[]; // unix seconds
  equity: number[];
}

export function getPortfolioHistory(): Promise<PortfolioHistory> {
  return tradingRequest<PortfolioHistory>("/v2/account/portfolio/history?period=1M&timeframe=1D");
}

export interface BracketOrderInput {
  symbol: string;
  side: "buy" | "sell";
  qty: string; // string to preserve fractional precision (crypto)
  stopPrice: number;
  assetClass: "us_equity" | "crypto";
}

/** Places a market entry with a hard stop-loss attached as a bracket order --
 * the stop is enforced by Alpaca itself, not by application logic polling
 * afterward, so it survives the bot process not running for a tick. */
export function placeBracketOrder(input: BracketOrderInput): Promise<Order> {
  return tradingRequest<Order>("/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol: input.symbol,
      qty: input.qty,
      side: input.side,
      type: "market",
      time_in_force: input.assetClass === "crypto" ? "gtc" : "day",
      order_class: "bracket",
      stop_loss: { stop_price: input.stopPrice.toFixed(2) },
    }),
  });
}

/** Market-closes an open position (used for signal-based exits, distinct
 * from the hard stop-loss which Alpaca enforces on its own). */
export function closePosition(symbol: string): Promise<Order> {
  return tradingRequest<Order>(`/v2/positions/${encodeURIComponent(symbol)}`, { method: "DELETE" });
}
