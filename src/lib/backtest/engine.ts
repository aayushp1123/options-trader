import type { Bar } from "@/lib/alpaca/types";
import { sizePosition } from "@/lib/risk/positionSizing";
import type { MarketConfig } from "@/lib/bot/markets";

export interface BacktestTrade {
  side: "long" | "short";
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  exitReason: "stop" | "signal";
  qty: number;
  pnl: number;
  pnlPct: number; // return on this trade's notional, not on total equity
}

export interface BacktestResult {
  symbol: string;
  strategyLabel: string;
  startingEquity: number;
  endingEquity: number;
  totalReturnPct: number;
  trades: BacktestTrade[];
  winRate: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
  maxDrawdownPct: number;
}

const WARMUP_BARS = 60; // enough history for the longest indicator (EMA50) before ever evaluating a signal

/**
 * Replays a market's exact production strategy functions (getSignal/
 * getExit) bar-by-bar against real historical data. At each step i, only
 * bars[0..i] are visible to the strategy -- the same slice a live tick
 * would have at that point in time -- so this can't cheat by looking ahead.
 * Position sizing reuses the real sizePosition() too, so the backtest
 * reflects the same 1%-risk/20%-notional-cap rules the live bot enforces,
 * not an idealized version of them.
 *
 * Simplification, stated plainly rather than silently assumed: each
 * market is backtested with its own independent starting equity, not as
 * one shared portfolio. The correlation filter (blocking a QQQ long while
 * SPY is already long) is therefore not exercised here -- it only matters
 * when multiple markets share one real capital pool, which this per-market
 * evaluation deliberately isn't modeling. This measures each strategy's
 * raw edge on its instrument, not full-portfolio behavior.
 *
 * The hard stop is checked against each bar's actual high/low (not just
 * its close), matching how a real resting stop order can fill intrabar --
 * a close-only check would understate how often the stop actually gets
 * hit before a signal-based exit would have fired.
 */
export function runBacktest(bars: Bar[], market: MarketConfig, startingEquity: number): BacktestResult {
  let equity = startingEquity;
  let peakEquity = startingEquity;
  let maxDrawdown = 0;
  const trades: BacktestTrade[] = [];

  let position: { side: "long" | "short"; entryPrice: number; qty: number; stopPrice: number; entryDate: string } | null = null;

  for (let i = WARMUP_BARS; i < bars.length; i++) {
    const window = bars.slice(0, i + 1);
    const bar = bars[i];

    if (position) {
      const stopHit = position.side === "long" ? bar.l <= position.stopPrice : bar.h >= position.stopPrice;
      const exit = stopHit ? { shouldExit: true, reason: "hard stop" } : market.getExit(window, position.side);

      if (exit.shouldExit) {
        const exitPrice = stopHit ? position.stopPrice : bar.c;
        const pnl = (position.side === "long" ? exitPrice - position.entryPrice : position.entryPrice - exitPrice) * position.qty;
        equity += pnl;
        trades.push({
          side: position.side,
          entryDate: position.entryDate,
          entryPrice: position.entryPrice,
          exitDate: bar.t,
          exitPrice,
          exitReason: stopHit ? "stop" : "signal",
          qty: position.qty,
          pnl,
          pnlPct: (pnl / (position.entryPrice * position.qty)) * 100,
        });
        position = null;
      }
    } else {
      const signal = market.getSignal(window);
      if (signal) {
        const sized = sizePosition({
          equity,
          entryPrice: signal.entryPrice,
          atr: signal.atr,
          side: signal.side,
          fractional: market.assetClass === "crypto",
        });
        if (sized.qty > 0) {
          position = { side: signal.side, entryPrice: signal.entryPrice, qty: sized.qty, stopPrice: sized.stopPrice, entryDate: bar.t };
        }
      }
    }

    const markEquity = position
      ? equity + (position.side === "long" ? bar.c - position.entryPrice : position.entryPrice - bar.c) * position.qty
      : equity;
    peakEquity = Math.max(peakEquity, markEquity);
    maxDrawdown = Math.max(maxDrawdown, (peakEquity - markEquity) / peakEquity);
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);

  return {
    symbol: market.symbol,
    strategyLabel: market.strategyLabel,
    startingEquity,
    endingEquity: equity,
    totalReturnPct: ((equity - startingEquity) / startingEquity) * 100,
    trades,
    winRate: trades.length ? (wins.length / trades.length) * 100 : null,
    avgWinPct: wins.length ? wins.reduce((sum, t) => sum + t.pnlPct, 0) / wins.length : null,
    avgLossPct: losses.length ? losses.reduce((sum, t) => sum + t.pnlPct, 0) / losses.length : null,
    maxDrawdownPct: maxDrawdown * 100,
  };
}
