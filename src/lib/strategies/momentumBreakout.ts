import type { Bar } from "@/lib/alpaca/types";
import { atr, donchianChannel } from "@/lib/indicators";
import type { ExitCheck, Signal } from "./types";

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
