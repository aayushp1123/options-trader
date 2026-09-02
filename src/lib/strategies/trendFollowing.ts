import type { Bar } from "@/lib/alpaca/types";
import { adx, atr, ema } from "@/lib/indicators";
import type { ExitCheck, MarketDiagnostics, Signal } from "./types";

const FAST_PERIOD = 20;
const SLOW_PERIOD = 50;
const ADX_PERIOD = 14;
const ATR_PERIOD = 14;
/** ADX above this confirms a real trend -- "commodities move in cleaner
 * waves", so this filter exists to keep entry noise out, same idea as the
 * mean-reversion ADX filter but inverted (we want the trend confirmed here,
 * not absent). */
const MIN_ADX_FOR_ENTRY = 20;

/** Gold/Oil 4-hour trend following: EMA20/EMA50 crossover, confirmed by
 * ADX so a weak/noisy cross doesn't trigger an entry. */
export function trendFollowingSignal(bars: Bar[]): Signal | null {
  const closes = bars.map((b) => b.c);
  const fast = ema(closes, FAST_PERIOD);
  const slow = ema(closes, SLOW_PERIOD);
  const trendStrength = adx(bars, ADX_PERIOD);
  const volatility = atr(bars, ATR_PERIOD);
  if (fast === null || slow === null || trendStrength === null || volatility === null) return null;
  if (trendStrength < MIN_ADX_FOR_ENTRY) return null;

  const entryPrice = closes[closes.length - 1];
  if (fast > slow) {
    return { side: "long", reason: `EMA${FAST_PERIOD}>EMA${SLOW_PERIOD}, ADX=${trendStrength.toFixed(1)} trending`, entryPrice, atr: volatility };
  }
  return { side: "short", reason: `EMA${FAST_PERIOD}<EMA${SLOW_PERIOD}, ADX=${trendStrength.toFixed(1)} trending`, entryPrice, atr: volatility };
}

export function trendFollowingDiagnostics(bars: Bar[]): MarketDiagnostics | null {
  if (bars.length === 0) return null;
  const closes = bars.map((b) => b.c);
  const fast = ema(closes, FAST_PERIOD);
  const slow = ema(closes, SLOW_PERIOD);
  const trendStrength = adx(bars, ADX_PERIOD);
  const price = closes[closes.length - 1];
  const confirmed = trendStrength !== null && trendStrength >= MIN_ADX_FOR_ENTRY;

  let wouldTrigger: "long" | "short" | null = null;
  if (fast !== null && slow !== null && confirmed) {
    wouldTrigger = fast > slow ? "long" : "short";
  }

  return {
    price,
    wouldTrigger,
    note: confirmed
      ? `Trend confirmed by ADX -- ${fast !== null && slow !== null && fast > slow ? "up" : "down"}trend`
      : "Waiting for ADX to confirm a real trend before entering",
    indicators: [
      { label: `EMA${FAST_PERIOD}`, value: fast !== null ? fast.toFixed(2) : "—", status: "neutral" },
      { label: `EMA${SLOW_PERIOD}`, value: slow !== null ? slow.toFixed(2) : "—", status: "neutral" },
      {
        label: "ADX(14)",
        value: trendStrength !== null ? trendStrength.toFixed(1) : "—",
        status: confirmed ? "good" : "warn",
      },
    ],
  };
}

export function trendFollowingExit(bars: Bar[], side: "long" | "short"): ExitCheck {
  const closes = bars.map((b) => b.c);
  const fast = ema(closes, FAST_PERIOD);
  const slow = ema(closes, SLOW_PERIOD);
  if (fast === null || slow === null) return { shouldExit: false, reason: "insufficient data" };

  const flipped = side === "long" ? fast <= slow : fast >= slow;
  return flipped ? { shouldExit: true, reason: "trend reversed" } : { shouldExit: false, reason: "trend intact" };
}
