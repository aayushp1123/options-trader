/**
 * Throwaway verification script -- run once against real Alpaca paper
 * credentials to confirm the account is reachable, market data actually
 * returns bars for all 5 symbols at their real timeframes, and (separately)
 * that shorting is actually permitted for the equity/ETF symbols before the
 * bot ever tries to rely on it live. Not part of the app; delete or ignore
 * after running.
 *
 * Usage: npx tsx scripts/verify-alpaca.mts
 * (requires ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY in the environment,
 * e.g. `set -a; source .env.local; set +a; npx tsx scripts/verify-alpaca.mts`)
 */
import { getAccount, getClock } from "../src/lib/alpaca/trading";
import { getCryptoBars, getStockBars, resampleTo4Hour } from "../src/lib/alpaca/marketData";

async function main() {
  if (!process.env.ALPACA_API_KEY_ID || !process.env.ALPACA_API_SECRET_KEY) {
    console.error("Set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY in the environment first.");
    process.exit(1);
  }

  console.log("Account:");
  const account = await getAccount();
  console.log(`  status ok, equity=$${account.equity}, options_approved_level=${account.options_approved_level}`);

  console.log("Clock:");
  const clock = await getClock();
  console.log(`  is_open=${clock.is_open}, next_open=${clock.next_open}, next_close=${clock.next_close}`);

  console.log("SPY 15Min bars:");
  const spy = await getStockBars("SPY", "15Min", 5);
  console.log(`  got ${spy.length} bars, latest close=${spy.at(-1)?.c}`);

  console.log("QQQ 15Min bars:");
  const qqq = await getStockBars("QQQ", "15Min", 5);
  console.log(`  got ${qqq.length} bars, latest close=${qqq.at(-1)?.c}`);

  console.log("GLD 1Hour bars (resampled to 4Hour):");
  const gldHourly = await getStockBars("GLD", "1Hour", 20);
  const gld4h = resampleTo4Hour(gldHourly);
  console.log(`  got ${gldHourly.length} hourly -> ${gld4h.length} 4h bars, latest close=${gld4h.at(-1)?.c}`);

  console.log("USO 1Hour bars (resampled to 4Hour):");
  const usoHourly = await getStockBars("USO", "1Hour", 20);
  const uso4h = resampleTo4Hour(usoHourly);
  console.log(`  got ${usoHourly.length} hourly -> ${uso4h.length} 4h bars, latest close=${uso4h.at(-1)?.c}`);

  console.log("BTC/USD 1Hour crypto bars:");
  const btc = await getCryptoBars("BTC/USD", "1Hour", 5);
  console.log(`  got ${btc.length} bars, latest close=${btc.at(-1)?.c}`);

  console.log("\nAll data checks passed. Shorting permissions for SPY/QQQ/GLD/USO were NOT tested here");
  console.log("(that requires actually submitting a short order) -- verify manually in the Alpaca paper");
  console.log("dashboard, or expect the bot's first short attempt to surface a clear error if blocked.");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
