export interface Bar {
  t: string; // ISO timestamp
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Position {
  asset_id: string;
  symbol: string;
  asset_class: "us_equity" | "crypto";
  side: "long" | "short";
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: string | null;
  notional: string | null;
  status: string;
  order_class: string;
  submitted_at: string;
  filled_at: string | null;
  filled_avg_price: string | null;
}

export interface Clock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}
