export interface Signal {
  side: "long" | "short";
  reason: string;
  entryPrice: number;
  atr: number;
}

export interface ExitCheck {
  shouldExit: boolean;
  reason: string;
}

/** A live, always-present snapshot of what a strategy is currently seeing
 * for a market -- distinct from Signal, which only exists when an entry
 * condition is actually met. Powers the dashboard's "what the bot is
 * watching" panel so a real signal firing isn't the only visible state. */
export interface MarketDiagnostics {
  price: number;
  wouldTrigger: "long" | "short" | null;
  note: string;
  indicators: Array<{ label: string; value: string; status: "good" | "warn" | "neutral" }>;
}
