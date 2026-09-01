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
