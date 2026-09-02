import type { Bar } from "@/lib/alpaca/types";
import { meanReversionDiagnostics, meanReversionExit, meanReversionSignal } from "@/lib/strategies/meanReversion";
import {
  momentumBreakoutDiagnostics,
  momentumBreakoutExit,
  momentumBreakoutSignal,
} from "@/lib/strategies/momentumBreakout";
import { trendFollowingDiagnostics, trendFollowingExit, trendFollowingSignal } from "@/lib/strategies/trendFollowing";
import type { ExitCheck, MarketDiagnostics, Signal } from "@/lib/strategies/types";

export interface MarketConfig {
  symbol: string;
  assetClass: "us_equity" | "crypto";
  strategyLabel: string;
  getSignal: (bars: Bar[]) => Signal | null;
  getExit: (bars: Bar[], side: "long" | "short") => ExitCheck;
  getDiagnostics: (bars: Bar[]) => MarketDiagnostics | null;
}

export const MARKETS: MarketConfig[] = [
  {
    symbol: "SPY",
    assetClass: "us_equity",
    strategyLabel: "mean-reversion-15m",
    getSignal: meanReversionSignal,
    getExit: meanReversionExit,
    getDiagnostics: meanReversionDiagnostics,
  },
  {
    symbol: "QQQ",
    assetClass: "us_equity",
    strategyLabel: "mean-reversion-15m",
    getSignal: meanReversionSignal,
    getExit: meanReversionExit,
    getDiagnostics: meanReversionDiagnostics,
  },
  {
    symbol: "BTC/USD",
    assetClass: "crypto",
    strategyLabel: "momentum-breakout-1h",
    getSignal: momentumBreakoutSignal,
    getExit: (bars) => momentumBreakoutExit(bars),
    getDiagnostics: momentumBreakoutDiagnostics,
  },
  {
    symbol: "GLD",
    assetClass: "us_equity",
    strategyLabel: "trend-following-4h",
    getSignal: trendFollowingSignal,
    getExit: trendFollowingExit,
    getDiagnostics: trendFollowingDiagnostics,
  },
  {
    symbol: "USO",
    assetClass: "us_equity",
    strategyLabel: "trend-following-4h",
    getSignal: trendFollowingSignal,
    getExit: trendFollowingExit,
    getDiagnostics: trendFollowingDiagnostics,
  },
];
