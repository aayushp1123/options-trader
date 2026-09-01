import type { Position } from "@/lib/alpaca/types";

/**
 * Nasdaq (QQQ) and S&P 500 (SPY) move together closely enough that a long
 * position in both is effectively one doubled-up risk-on bet, not two
 * independent ones. If either is already long, block a new long entry in
 * the other -- narrow rule, just this one named pair, not a general
 * cross-market correlation matrix.
 */
export function blockedByCorrelation(symbol: string, side: "long" | "short", openPositions: Position[]): boolean {
  if (side !== "long") return false;
  const pair: Record<string, string> = { SPY: "QQQ", QQQ: "SPY" };
  const counterpart = pair[symbol];
  if (!counterpart) return false;
  return openPositions.some((p) => p.symbol === counterpart && p.side === "long");
}
