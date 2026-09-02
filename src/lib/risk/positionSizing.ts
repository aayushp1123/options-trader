const RISK_PCT = 0.01; // hard 1% of equity per trade, no exceptions
const STOP_ATR_MULTIPLIER = 1.5;
/** Second, independent cap: no single position's notional exposure exceeds
 * this fraction of equity, regardless of what the dollar-risk formula alone
 * would produce. Needed because risk_dollars / stop_distance has no upper
 * bound on its own -- confirmed live: BTC's ATR was only ~0.32% of its
 * price, so the pure risk-based formula sized a $206k notional position on
 * a $100k account (over 2x leverage) before this cap existed. Dollar risk
 * at the stop and notional exposure are two different things; both need a
 * limit, not just the first one. */
const MAX_NOTIONAL_PCT = 0.2;

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
 *
 * That risk-based qty is then capped by MAX_NOTIONAL_PCT so an asset with
 * tight relative volatility (large price, small ATR% of price -- crypto in
 * particular) can't size into an outsized, effectively-leveraged position
 * just because its stop distance happens to be small.
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

  const riskBasedQty = riskDollars / stopDistance;
  const maxNotionalQty = (equity * MAX_NOTIONAL_PCT) / entryPrice;
  const rawQty = Math.min(riskBasedQty, maxNotionalQty);

  const qty = fractional ? Math.round(rawQty * 1e6) / 1e6 : Math.floor(rawQty);
  return { stopDistance, stopPrice, qty, riskDollars };
}
