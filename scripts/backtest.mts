/**
 * Runs the exact production strategies against real historical Alpaca data
 * to see how they'd actually have performed, instead of only finding out by
 * watching the live bot for weeks. Not part of the deployed app -- run
 * manually: `npm run backtest` (requires ALPACA_API_KEY_ID/SECRET_KEY in
 * the environment).
 */
import { getStockBarsRange, getCryptoBarsRange, resampleTo4Hour } from "../src/lib/alpaca/marketData";
import { MARKETS } from "../src/lib/bot/markets";
import { runBacktest, runWalkForward, type BacktestResult } from "../src/lib/backtest/engine";
import type { Bar } from "../src/lib/alpaca/types";

const STARTING_EQUITY = 100_000;
const EQUITY_MONTHS_BACK = 6;
const COMMODITY_MONTHS_BACK = 12; // 4h bars need a longer window for enough trades to be meaningful
const WALK_FORWARD_PERIODS = 3;

function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

async function fetchHistory(market: (typeof MARKETS)[number]): Promise<Bar[]> {
  if (market.assetClass === "crypto") {
    return getCryptoBarsRange(market.symbol, "1Hour", monthsAgoISO(EQUITY_MONTHS_BACK));
  }
  if (market.strategyLabel === "trend-following-4h") {
    const hourly = await getStockBarsRange(market.symbol, "1Hour", monthsAgoISO(COMMODITY_MONTHS_BACK));
    return resampleTo4Hour(hourly);
  }
  return getStockBarsRange(market.symbol, "15Min", monthsAgoISO(EQUITY_MONTHS_BACK));
}

function printResult(r: BacktestResult, barCount: number) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${r.symbol} (${r.strategyLabel}) -- ${barCount} bars`);
  console.log("=".repeat(60));
  console.log(`Trades: ${r.trades.length}`);
  if (r.trades.length === 0) {
    console.log("No trades triggered in this window -- either the window is too short,");
    console.log("or this strategy's entry conditions genuinely didn't occur.");
    return;
  }
  console.log(`Total return: ${r.totalReturnPct >= 0 ? "+" : ""}${r.totalReturnPct.toFixed(2)}% ($${r.startingEquity.toLocaleString()} -> $${r.endingEquity.toFixed(2)})`);
  console.log(`Win rate: ${r.winRate?.toFixed(1)}% (${r.trades.filter((t) => t.pnl > 0).length}W / ${r.trades.filter((t) => t.pnl <= 0).length}L)`);
  console.log(`Avg win: ${r.avgWinPct !== null ? `+${r.avgWinPct.toFixed(2)}%` : "—"}  Avg loss: ${r.avgLossPct !== null ? `${r.avgLossPct.toFixed(2)}%` : "—"}`);
  console.log(`Max drawdown: -${r.maxDrawdownPct.toFixed(2)}%`);
  const stopExits = r.trades.filter((t) => t.exitReason === "stop").length;
  console.log(`Exits via hard stop: ${stopExits}/${r.trades.length} (${((stopExits / r.trades.length) * 100).toFixed(0)}%)`);
  console.log("\nRecent trades:");
  for (const t of r.trades.slice(-5)) {
    console.log(
      `  ${t.side.padEnd(5)} entry ${t.entryPrice.toFixed(2)} (${t.entryDate.slice(0, 10)}) -> exit ${t.exitPrice.toFixed(2)} (${t.exitDate.slice(0, 10)}, ${t.exitReason}) = ${t.pnlPct >= 0 ? "+" : ""}${t.pnlPct.toFixed(2)}%`
    );
  }
}

function printWalkForward(symbol: string, bars: Bar[], market: (typeof MARKETS)[number]) {
  const periods = runWalkForward(bars, market, STARTING_EQUITY, WALK_FORWARD_PERIODS);
  console.log(`\nWalk-forward (${WALK_FORWARD_PERIODS} sequential periods) -- is the edge consistent, or one lucky window?`);
  if (periods.length === 0) {
    console.log("  Not enough bars to split into meaningful periods.");
    return;
  }
  for (const p of periods) {
    const r = p.result;
    const range = `${p.startDate.slice(0, 10)} -> ${p.endDate.slice(0, 10)}`;
    if (r.trades.length === 0) {
      console.log(`  Period ${p.periodIndex} (${range}): 0 trades`);
      continue;
    }
    console.log(
      `  Period ${p.periodIndex} (${range}): ${r.trades.length} trades, ${r.totalReturnPct >= 0 ? "+" : ""}${r.totalReturnPct.toFixed(2)}%, win rate ${r.winRate?.toFixed(0)}%, maxDD -${r.maxDrawdownPct.toFixed(1)}%`
    );
  }
  const positivePeriods = periods.filter((p) => p.result.totalReturnPct > 0).length;
  const periodsWithTrades = periods.filter((p) => p.result.trades.length > 0).length;
  if (periodsWithTrades > 0) {
    console.log(`  -> Positive in ${positivePeriods}/${periodsWithTrades} periods that actually traded.`);
  }
}

async function main() {
  if (!process.env.ALPACA_API_KEY_ID || !process.env.ALPACA_API_SECRET_KEY) {
    console.error("Set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY in the environment first.");
    process.exit(1);
  }

  console.log(`Fetching real historical bars for all 5 markets (${EQUITY_MONTHS_BACK}mo equities/crypto, ${COMMODITY_MONTHS_BACK}mo for 4h commodities)...`);

  const results: Array<{ result: BacktestResult; barCount: number }> = [];
  for (const market of MARKETS) {
    const bars = await fetchHistory(market);
    const result = runBacktest(bars, market, STARTING_EQUITY);
    results.push({ result, barCount: bars.length });
    printResult(result, bars.length);
    printWalkForward(market.symbol, bars, market);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));
  for (const { result, barCount } of results) {
    const label = `${result.symbol} (${barCount} bars, ${result.trades.length} trades)`;
    console.log(
      `${label.padEnd(38)} ${result.totalReturnPct >= 0 ? "+" : ""}${result.totalReturnPct.toFixed(2)}%  maxDD -${result.maxDrawdownPct.toFixed(1)}%`
    );
  }
  console.log("\nReminder: each market ran with its own independent $100k, not shared capital --");
  console.log("this measures each strategy's raw edge on its instrument, not full-portfolio behavior.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
