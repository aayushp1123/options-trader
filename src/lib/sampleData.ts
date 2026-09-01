import type { Position } from "@/lib/alpaca/types";
import type { Account, MarkPricePoint } from "./types";

/**
 * Placeholder sandbox data, shaped exactly like Alpaca's paper-trading API
 * responses. Used only as a fallback when ALPACA_API_KEY_ID /
 * ALPACA_API_SECRET_KEY aren't set yet -- see src/lib/bot/dashboardData.ts,
 * which prefers the real Alpaca account/positions once configured.
 */

export function getSampleAccount(): Account {
  return {
    account_number: "PA3XXXXXX1",
    buying_power: "48210.55",
    options_buying_power: "12500.00",
    cash: "18420.10",
    portfolio_value: "64730.90",
    equity: "64730.90",
    last_equity: "63180.40",
    daytrading_buying_power: "96421.10",
    options_approved_level: 2,
  };
}

function markSeries(base: number, points: number, drift: number): MarkPricePoint[] {
  const series: MarkPricePoint[] = [];
  const now = Date.now();
  let value = base;
  for (let i = points; i >= 0; i--) {
    value = Math.max(0.01, value + drift + (Math.random() - 0.5) * base * 0.02);
    series.push({ date: new Date(now - i * 3600000).toISOString(), value: Number(value.toFixed(2)) });
  }
  return series;
}

export function getSamplePositions(): Position[] {
  return [
    {
      asset_id: "eq_1",
      symbol: "SPY",
      asset_class: "us_equity",
      side: "long",
      qty: "18",
      avg_entry_price: "592.40",
      current_price: "596.30",
      market_value: "10733.40",
      unrealized_pl: "70.20",
      unrealized_plpc: "0.0066",
    },
    {
      asset_id: "eq_2",
      symbol: "GLD",
      asset_class: "us_equity",
      side: "short",
      qty: "-9",
      avg_entry_price: "244.10",
      current_price: "241.85",
      market_value: "-2176.65",
      unrealized_pl: "20.25",
      unrealized_plpc: "0.0092",
    },
    {
      asset_id: "cr_1",
      symbol: "BTCUSD",
      asset_class: "crypto",
      side: "long",
      qty: "0.041",
      avg_entry_price: "108450.00",
      current_price: "111230.00",
      market_value: "4560.43",
      unrealized_pl: "113.98",
      unrealized_plpc: "0.0256",
    },
  ];
}

export function getSampleMarkSeries(symbol: string): MarkPricePoint[] {
  const position = getSamplePositions().find((p) => p.symbol === symbol);
  const base = position ? parseFloat(position.avg_entry_price) : 100;
  const drift = position ? (parseFloat(position.current_price) - base) / 80 : 0;
  return markSeries(base, 80, drift);
}

export function getSamplePortfolioSeries(): MarkPricePoint[] {
  return markSeries(63000, 60, 30);
}
