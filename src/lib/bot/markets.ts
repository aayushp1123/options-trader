import type { Bar } from "@/lib/alpaca/types";
import { meanReversionExit, meanReversionSignal } from "@/lib/strategies/meanReversion";
import { momentumBreakoutExit, momentumBreakoutSignal } from "@/lib/strategies/momentumBreakout";
import { trendFollowingExit, trendFollowingSignal } from "@/lib/strategies/trendFollowing";
import type { ExitCheck, Signal } from "@/lib/strategies/types";

export interface MarketConfig {
  symbol: string;
  assetClass: "us_equity" | "crypto";
  strategyLabel: string;
  getSignal: (bars: Bar[]) => Signal | null;
  getExit: (bars: Bar[], side: "long" | "short") => ExitCheck;
}

export const MARKETS: MarketConfig[] = [
  {
    symbol: "SPY",
    assetClass: "us_equity",
    strategyLabel: "mean-reversion-15m",
    getSignal: meanReversionSignal,
    getExit: meanReversionExit,
  },
  {
    symbol: "QQQ",
    assetClass: "us_equity",
    strategyLabel: "mean-reversion-15m",
    getSignal: meanReversionSignal,
    getExit: meanReversionExit,
  },
  {
    symbol: "BTC/USD",
    assetClass: "crypto",
    strategyLabel: "momentum-breakout-1h",
    getSignal: momentumBreakoutSignal,
    getExit: (bars) => momentumBreakoutExit(bars),
  },
  {
    symbol: "GLD",
    assetClass: "us_equity",
    strategyLabel: "trend-following-4h",
    getSignal: trendFollowingSignal,
    getExit: trendFollowingExit,
  },
  {
    symbol: "USO",
    assetClass: "us_equity",
    strategyLabel: "trend-following-4h",
    getSignal: trendFollowingSignal,
    getExit: trendFollowingExit,
  },
];
