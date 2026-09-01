import type { Bar } from "@/lib/alpaca/types";

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

export function stdev(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((sum, v) => sum + v, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let value = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  for (let i = period; i < values.length; i++) {
    value = values[i] * k + value * (1 - k);
  }
  return value;
}

/** Zero-lag-ish z-score of the latest close vs. its rolling mean, in units
 * of standard deviation -- the core mean-reversion signal input. */
export function zScore(closes: number[], period: number): number | null {
  const mean = sma(closes, period);
  const sd = stdev(closes, period);
  if (mean === null || sd === null || sd === 0) return null;
  return (closes[closes.length - 1] - mean) / sd;
}

/** Average True Range (Wilder's smoothing), the shared volatility measure
 * used for both stop distance and position sizing across all strategies. */
export function atr(bars: Bar[], period: number): number | null {
  if (bars.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { h, l, c: prevClose } = { h: bars[i].h, l: bars[i].l, c: bars[i - 1].c };
    trueRanges.push(Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose)));
  }
  let value = trueRanges.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    value = (value * (period - 1) + trueRanges[i]) / period;
  }
  return value;
}

/** Average Directional Index (Wilder), used as a regime filter: low ADX =
 * range-bound/choppy (good for mean reversion), high ADX = trending (good
 * for breakout/trend-following, bad for mean reversion). */
export function adx(bars: Bar[], period: number): number | null {
  if (bars.length < period * 2) return null;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].h - bars[i - 1].h;
    const downMove = bars[i - 1].l - bars[i].l;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c)));
  }

  function wilderSmooth(values: number[]): number[] {
    const smoothed = [values.slice(0, period).reduce((sum, v) => sum + v, 0)];
    for (let i = period; i < values.length; i++) {
      smoothed.push(smoothed[smoothed.length - 1] - smoothed[smoothed.length - 1] / period + values[i]);
    }
    return smoothed;
  }

  const smoothTR = wilderSmooth(tr);
  const smoothPlusDM = wilderSmooth(plusDM);
  const smoothMinusDM = wilderSmooth(minusDM);

  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const sum = plusDI + minusDI;
    dx.push(sum === 0 ? 0 : (Math.abs(plusDI - minusDI) / sum) * 100);
  }
  if (dx.length < period) return null;
  return sma(dx, period);
}

/** Highest high / lowest low over the trailing window, excluding the most
 * recent (still-forming or just-closed) bar -- the Donchian breakout
 * reference level. */
export function donchianChannel(bars: Bar[], period: number): { upper: number; lower: number } | null {
  if (bars.length < period + 1) return null;
  const window = bars.slice(-period - 1, -1);
  return { upper: Math.max(...window.map((b) => b.h)), lower: Math.min(...window.map((b) => b.l)) };
}
