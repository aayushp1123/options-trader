import type { Bar } from "@/lib/alpaca/types";
import { atr, donchianChannel } from "@/lib/indicators";
import type { ExitCheck, MarketDiagnostics, Signal } from "./types";

const CHANNEL_PERIOD = 20;
const ATR_PERIOD = 14;

/** Bitcoin 1-hour momentum breakout: enter on a close beyond the trailing
 * Donchian channel. Alpaca's paper crypto trading is spot/long-only, so
 * only upside breakouts produce a signal here -- a downside break just
 * means "stay flat", not "go short", since there's no real short to take. */
export function momentumBreakoutSignal(bars: Bar[]): Signal | null {
  const channel = donchianChannel(bars, CHANNEL_PERIOD);
  const volatility = atr(bars, ATR_PERIOD);
  if (channel === null || volatility === null) return null;

  const last = bars[bars.length - 1];
  if (last.c > channel.upper) {
    return {
      side: "long",
      reason: `close ${last.c.toFixed(2)} broke above ${CHANNEL_PERIOD}-bar high ${channel.upper.toFixed(2)}`,
      entryPrice: last.c,
      atr: volatility,
    };
  }
  return null;
}

export function momentumBreakoutDiagnostics(bars: Bar[]): MarketDiagnostics | null {
  if (bars.length === 0) return null;
  const channel = donchianChannel(bars, CHANNEL_PERIOD);
  const last = bars[bars.length - 1];
  const wouldTrigger = channel && last.c > channel.upper ? "long" : null;
  const distancePct = channel ? ((channel.upper - last.c) / last.c) * 100 : null;

  return {
    price: last.c,
    wouldTrigger,
    note: channel
      ? wouldTrigger
        ? "Currently above the breakout level"
        : `Needs a close above ${channel.upper.toFixed(2)} to break out`
      : "Not enough history yet",
    indicators: [
      { label: `${CHANNEL_PERIOD}-bar high`, value: channel ? channel.upper.toFixed(2) : "—", status: "neutral" },
      { label: `${CHANNEL_PERIOD}-bar low`, value: channel ? channel.lower.toFixed(2) : "—", status: "neutral" },
      {
        label: "Distance to breakout",
        value: distancePct !== null ? `${distancePct.toFixed(2)}%` : "—",
        status: wouldTrigger ? "good" : "neutral",
      },
    ],
  };
}

/** Exit when price closes back inside the channel it broke out of --
 * the breakout has failed / momentum is gone. */
export function momentumBreakoutExit(bars: Bar[]): ExitCheck {
  const channel = donchianChannel(bars, CHANNEL_PERIOD);
  if (channel === null) return { shouldExit: false, reason: "insufficient data" };
  const last = bars[bars.length - 1];
  return last.c < channel.lower
    ? { shouldExit: true, reason: `close ${last.c.toFixed(2)} fell back below channel low ${channel.lower.toFixed(2)}` }
    : { shouldExit: false, reason: "breakout still holding" };
}
