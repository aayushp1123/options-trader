import { getClock, getPositions } from "@/lib/alpaca/trading";
import type { MarketDiagnostics } from "@/lib/strategies/types";
import { fetchBars } from "./runner";
import { MARKETS } from "./markets";

export interface MarketScan {
  symbol: string;
  strategyLabel: string;
  hasPosition: boolean;
  marketOpen: boolean; // always true for crypto, real clock check for equities
  diagnostics: MarketDiagnostics | null;
  error?: string;
}

/** Live read-only snapshot of what each strategy currently sees -- distinct
 * from runTick(), which acts on it. Powers the dashboard's "what the bot is
 * watching" panel; never places or closes anything. */
export async function scanMarkets(): Promise<MarketScan[]> {
  const [positions, clock] = await Promise.all([getPositions(), getClock()]);
  const results: MarketScan[] = [];

  for (const market of MARKETS) {
    const marketOpen = market.assetClass === "crypto" ? true : clock.is_open;
    const hasPosition = positions.some((p) => p.symbol === market.symbol.replace("/", ""));

    if (!marketOpen) {
      results.push({ symbol: market.symbol, strategyLabel: market.strategyLabel, hasPosition, marketOpen, diagnostics: null });
      continue;
    }

    try {
      const bars = await fetchBars(market);
      const diagnostics = market.getDiagnostics(bars);
      results.push({ symbol: market.symbol, strategyLabel: market.strategyLabel, hasPosition, marketOpen, diagnostics });
    } catch (err) {
      results.push({
        symbol: market.symbol,
        strategyLabel: market.strategyLabel,
        hasPosition,
        marketOpen,
        diagnostics: null,
        error: (err as Error).message,
      });
    }
  }

  return results;
}
