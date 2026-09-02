import type { Bar } from "@/lib/alpaca/types";
import { adx, atr, sma, zScore } from "@/lib/indicators";
import type { ExitCheck, MarketDiagnostics, Signal } from "./types";

const LOOKBACK = 20;
const ADX_PERIOD = 14;
const ATR_PERIOD = 14;
const ENTRY_Z = 2;
const EXIT_Z = 0.3;
/** ADX below this = range-bound/choppy, i.e. "constant small opportunities"
 * -- exactly the regime mean reversion needs. Above it, price is trending
 * and a reversion bet is more likely to be a falling knife, so we sit out. */
const MAX_ADX_FOR_ENTRY = 20;

/** SPY/QQQ 15-minute mean reversion: enter against an extreme z-score
 * deviation from the rolling mean, but only when ADX confirms the market
 * is actually range-bound rather than trending. */
export function meanReversionSignal(bars: Bar[]): Signal | null {
  const closes = bars.map((b) => b.c);
  const z = zScore(closes, LOOKBACK);
  const trendStrength = adx(bars, ADX_PERIOD);
  const volatility = atr(bars, ATR_PERIOD);
  if (z === null || trendStrength === null || volatility === null) return null;
  if (trendStrength >= MAX_ADX_FOR_ENTRY) return null;

  const entryPrice = closes[closes.length - 1];
  if (z <= -ENTRY_Z) {
    return { side: "long", reason: `z=${z.toFixed(2)} oversold, ADX=${trendStrength.toFixed(1)} range-bound`, entryPrice, atr: volatility };
  }
  if (z >= ENTRY_Z) {
    return { side: "short", reason: `z=${z.toFixed(2)} overbought, ADX=${trendStrength.toFixed(1)} range-bound`, entryPrice, atr: volatility };
  }
  return null;
}

export function meanReversionDiagnostics(bars: Bar[]): MarketDiagnostics | null {
  if (bars.length === 0) return null;
  const closes = bars.map((b) => b.c);
  const z = zScore(closes, LOOKBACK);
  const trendStrength = adx(bars, ADX_PERIOD);
  const price = closes[closes.length - 1];
  const rangeBound = trendStrength !== null && trendStrength < MAX_ADX_FOR_ENTRY;

  let wouldTrigger: "long" | "short" | null = null;
  if (z !== null && rangeBound) {
    if (z <= -ENTRY_Z) wouldTrigger = "long";
    else if (z >= ENTRY_Z) wouldTrigger = "short";
  }

  return {
    price,
    wouldTrigger,
    note: rangeBound
      ? `Range-bound -- watching for a |z| >= ${ENTRY_Z} extreme to fade`
      : "Trending too strongly right now -- mean reversion paused until ADX drops",
    indicators: [
      {
        label: "Z-score",
        value: z !== null ? z.toFixed(2) : "—",
        status: z !== null && Math.abs(z) >= ENTRY_Z ? "warn" : "neutral",
      },
      {
        label: "ADX(14)",
        value: trendStrength !== null ? trendStrength.toFixed(1) : "—",
        status: rangeBound ? "good" : "warn",
      },
      { label: "Entry needs", value: `|z| >= ${ENTRY_Z}, ADX < ${MAX_ADX_FOR_ENTRY}`, status: "neutral" },
    ],
  };
}

export function meanReversionExit(bars: Bar[], side: "long" | "short"): ExitCheck {
  const closes = bars.map((b) => b.c);
  const mean = sma(closes, LOOKBACK);
  const z = zScore(closes, LOOKBACK);
  if (mean === null || z === null) return { shouldExit: false, reason: "insufficient data" };

  const reverted = side === "long" ? z >= -EXIT_Z : z <= EXIT_Z;
  return reverted
    ? { shouldExit: true, reason: `reverted to mean, z=${z.toFixed(2)}` }
    : { shouldExit: false, reason: "not yet reverted" };
}
