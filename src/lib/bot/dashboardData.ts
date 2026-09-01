import { isAlpacaConfigured } from "@/lib/alpaca/client";
import type { Position } from "@/lib/alpaca/types";
import { getAccount, getPortfolioHistory, getPositions } from "@/lib/alpaca/trading";
import { getSampleAccount, getSamplePortfolioSeries, getSamplePositions } from "@/lib/sampleData";
import type { Account, MarkPricePoint } from "@/lib/types";
import { MARKETS } from "./markets";

export interface DisplayPosition extends Position {
  strategyLabel: string;
}

export interface DashboardData {
  account: Account;
  positions: DisplayPosition[];
  portfolioSeries: MarkPricePoint[];
  live: boolean; // false when running on sample/placeholder data
}

function withStrategyLabels(positions: Position[]): DisplayPosition[] {
  return positions.map((p) => {
    const market = MARKETS.find((m) => m.symbol.replace("/", "") === p.symbol);
    return { ...p, strategyLabel: market?.strategyLabel ?? "unmanaged" };
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!isAlpacaConfigured()) {
    return {
      account: getSampleAccount(),
      positions: withStrategyLabels(getSamplePositions()),
      portfolioSeries: getSamplePortfolioSeries(),
      live: false,
    };
  }

  const [account, positions, history] = await Promise.all([getAccount(), getPositions(), getPortfolioHistory()]);
  const portfolioSeries: MarkPricePoint[] = history.timestamp.map((t, i) => ({
    date: new Date(t * 1000).toISOString(),
    value: history.equity[i],
  }));

  return { account, positions: withStrategyLabels(positions), portfolioSeries, live: true };
}
