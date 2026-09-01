const RISK_PCT = 0.01; // hard 1% of equity per trade, no exceptions
const STOP_ATR_MULTIPLIER = 1.5;

export interface SizedPosition {
  stopDistance: number;
  stopPrice: number;
  qty: number;
  riskDollars: number;
}

/**
 * Position size is derived, not fixed: the stop distance (in price terms)
 * scales with that day's ATR, so a wide-ATR (volatile) day gets a smaller
 * position and a narrow-ATR (calm) day gets a larger one -- the dollar risk
 * (1% of equity) stays constant either way. The 1% stop itself is the hard
 * constraint; ATR only decides how far away, in price, it has to sit.
 */
export function sizePosition(params: {
  equity: number;
  entryPrice: number;
  atr: number;
  side: "long" | "short";
  fractional: boolean; // crypto allows fractional qty, equities are floored to whole shares
}): SizedPosition {
  const { equity, entryPrice, atr, side, fractional } = params;
  const stopDistance = atr * STOP_ATR_MULTIPLIER;
  const stopPrice = side === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;
  const riskDollars = equity * RISK_PCT;
  const rawQty = riskDollars / stopDistance;
  const qty = fractional ? Math.round(rawQty * 1e6) / 1e6 : Math.floor(rawQty);
  return { stopDistance, stopPrice, qty, riskDollars };
}
