# Options Desk

A sandbox multi-market trading bot + dashboard. Frontend design ported from
[portfolio-watcher](https://github.com/aayushp1123/portfolio-watcher) and
[PortfolioLab](https://github.com/PortfolioLab-Finance/100-investor) (theme,
layout, chart, modal patterns); backend trades against a real Alpaca
paper-trading account.

## What it does

Trades 5 markets, unsupervised, on a scheduled tick:

| Market | Symbol | Timeframe | Strategy |
|---|---|---|---|
| S&P 500 | SPY | 15-minute | Mean reversion (z-score extreme, ADX-filtered for range-bound regimes) |
| Nasdaq | QQQ | 15-minute | Mean reversion (same as SPY) |
| Bitcoin | BTC/USD | 1-hour | Momentum breakout (Donchian channel) — long-only, Alpaca crypto is spot |
| Gold | GLD | 4-hour (resampled from 1h) | Trend following (EMA20/50 cross, ADX-confirmed) |
| Oil | USO | 4-hour (resampled from 1h) | Trend following (same as GLD) |

**Risk management**, applied to every trade with no exceptions:
- Position size is derived from that day's ATR so the stop distance scales
  with volatility, but the dollar risk stays fixed at **1% of account
  equity** per trade (`src/lib/risk/positionSizing.ts`). A second,
  independent cap limits any single position to **20% of equity in notional
  exposure** regardless of what the pure risk formula computes — added
  after BTC's low relative volatility briefly sized a $206k position on a
  $100k account before this cap existed.
- The stop-loss is a real resting order at Alpaca, not the bot polling
  afterward. Equities use an `oto` order (entry + linked stop leg) since
  Alpaca's `bracket` class requires a take-profit these signal-exit
  strategies don't use. Crypto doesn't support `order_class`/`stop_loss` at
  all, so it's two independent orders instead (entry, then a stop_limit).
- A shortability check (`getAsset`) runs before any short equity entry —
  some symbols (USO, confirmed live) can't be shorted on this account, and
  the bot skips cleanly instead of a failed order every time.
- A correlation filter blocks a new long in QQQ if SPY is already long (and
  vice versa) — just that one pair, not a general cross-market matrix
  (`src/lib/risk/correlationFilter.ts`).
- One market's order/API failure can't take down the tick for the other 4 —
  each market is evaluated in its own try/catch.

Nasdaq/S&P exposure is via QQQ/SPY, Gold/Oil via GLD/USO — Alpaca doesn't
offer real index futures or commodities, only equities/ETFs/options/crypto.

## Auth

Single shared password (no user accounts/DB) — `AUTH_PASSWORD` in the
environment, verified against a stateless HMAC-signed session cookie
(`src/lib/auth/session.ts`). Every `/dashboard/*` route and `/api/bot/bars`
are gated by `src/proxy.ts` (Next.js 16's middleware convention).

## Backtesting

`npm run backtest` replays the exact production strategy functions against
months of real historical Alpaca data — same signal/exit logic, same
`sizePosition()`, bar-by-bar with no lookahead. Includes walk-forward
validation (3 sequential periods per market) specifically to catch a
strategy whose good aggregate number is really just one lucky trade — this
is exactly how USO's headline +10.66% return turned out to be 0/3 positive
periods when split, i.e. not a real edge.

## Setup

1. Create a free Alpaca account at https://alpaca.markets and generate
   **paper trading** API keys (Dashboard → Paper Trading → API Keys).
2. `cp .env.example .env.local` and fill in `ALPACA_API_KEY_ID` /
   `ALPACA_API_SECRET_KEY`. Generate `BOT_SECRET`, `AUTH_SECRET` with
   `openssl rand -hex 32` each, and pick an `AUTH_PASSWORD`.
3. `npm install`
4. Verify the connection actually works before trusting it:
   `set -a; source .env.local; set +a; npm run verify:alpaca`
5. `npm run dev` — the dashboard reads real Alpaca data once the keys are
   set (falls back to labeled sample data otherwise, so the UI never breaks
   without keys).

### Scheduling (GitHub Actions only)

`.github/workflows/trading-bot.yml` runs every 15 minutes and calls
`/api/bot/tick` on the deployed app — free, on GitHub's own infrastructure,
zero cost regardless of the hosting bill. The endpoint itself decides
per-tick what's actually due, so a late or duplicate trigger is harmless
(it checks Alpaca's real open positions before ever opening a new one).

A Netlify Scheduled Function was tried as a second, redundant scheduler and
**removed** — it (combined with many redeploys during live debugging)
burned 50% of the month's 300-credit free-tier allowance in two days.
Netlify's free plan has no grace period at 100%: the entire site goes
offline until the next billing cycle. That outage risk is worse than
GitHub's occasional multi-hour scheduling gaps, so GitHub Actions alone is
the safer choice here, not a compromise.

Repo secrets needed (Settings → Secrets and variables → Actions):
- `BOT_URL` — the deployed app's origin
- `BOT_SECRET` — same value as the deployment's env var

Also set `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, `BOT_SECRET`,
`AUTH_PASSWORD`, and `AUTH_SECRET` as environment variables on the actual
deployment (Netlify: Site configuration → Environment variables).

## Stack

Next.js 16 (App Router) + React 19 + Tailwind CSS v4, deployed on Netlify.
No database — Alpaca's own account/positions/order-history endpoints are
the source of truth, so there's nothing to keep in sync.

## Not built yet

- Order entry UI / manual override (intentional — no manual trigger exists
  anywhere in the trading path)
- Options contracts (this bot trades the underlying shares/crypto directly —
  the original UI scaffold was options-shaped, but mean-reversion/momentum/
  trend strategies with ATR stops are normally built on the underlying, not
  option premiums, so that's what got implemented)
