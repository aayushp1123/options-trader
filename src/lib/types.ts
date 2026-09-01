/**
 * Shapes intentionally mirror Alpaca's real Trading API responses
 * (GET /v2/account) so swapping sampleData.ts for real fetch calls later is
 * a drop-in -- no UI/type changes needed once the backend exists.
 */

export interface Account {
  account_number: string;
  buying_power: string;
  options_buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  daytrading_buying_power: string;
  options_approved_level: 0 | 1 | 2 | 3;
}

export interface MarkPricePoint {
  date: string; // ISO timestamp
  value: number; // price at that time
}
