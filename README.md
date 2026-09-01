# Options Desk

A sandbox multi-market trading bot + dashboard. Frontend design ported from
[portfolio-watcher](https://github.com/aayushp1123/portfolio-watcher) (theme,
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
  equity** per trade — calmer days get bigger size, volatile days get
  smaller size, same $ at risk either way (`src/lib/risk/positionSizing.ts`).
- The stop-loss is a real Alpaca bracket order attached at entry, enforced
  by Alpaca itself, not by the bot polling afterward.
- A correlation filter blocks a new long in QQQ if SPY is already long (and
  vice versa) — just that one pair, not a general cross-market matrix
  (`src/lib/risk/correlationFilter.ts`).

Nasdaq/S&P exposure is via QQQ/SPY, Gold/Oil via GLD/USO — Alpaca doesn't
offer real index futures or commodities, only equities/ETFs/options/crypto.

## Setup

1. Create a free Alpaca account at https://alpaca.markets and generate
   **paper trading** API keys (Dashboard → Paper Trading → API Keys).
2. `cp .env.example .env.local` and fill in `ALPACA_API_KEY_ID` /
   `ALPACA_API_SECRET_KEY`. Generate `BOT_SECRET` with `openssl rand -hex 32`.
3. `npm install`
4. Verify the connection actually works before trusting it:
   `set -a; source .env.local; set +a; npm run verify:alpaca`
   — confirms the account is reachable and real bars come back for all 5
   symbols at their real timeframes.
5. `npm run dev` — the dashboard reads real Alpaca data once the keys are
   set (falls back to labeled sample data otherwise, so the UI never breaks
   without keys).

### Scheduling (GitHub Actions, not Vercel Cron)

Vercel's Hobby-plan Cron is capped at once/day — too coarse for a
15-minute strategy. `.github/workflows/trading-bot.yml` runs every 15
minutes instead (free, GitHub Actions) and calls `/api/bot/tick` on your
deployed app. The endpoint itself decides per-tick what's actually due, so a
late or duplicate trigger is harmless (it checks Alpaca's real open
positions before ever opening a new one).

To wire it up, add these repo secrets (Settings → Secrets and variables →
Actions):
- `BOT_URL` — your deployed app's origin, e.g. `https://your-app.vercel.app`
- `BOT_SECRET` — same value as the `.env.local`/Vercel env var

Also set `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`, and `BOT_SECRET` as
environment variables on the Vercel project itself (Settings →
Environment Variables) — that's what the deployed `/api/bot/tick` route
actually reads.

## Stack

Next.js 16 (App Router) + React 19 + Tailwind CSS v4, matching
portfolio-watcher's stack. No database — Alpaca's own account/positions/
order-history endpoints are the source of truth, so there's nothing to keep
in sync.

## Not built yet

- Auth (every route is currently open)
- Order entry UI / manual override
- Options contracts (this bot trades the underlying shares/crypto directly —
  the original UI scaffold was options-shaped, but mean-reversion/momentum/
  trend strategies with ATR stops are normally built on the underlying, not
  option premiums, so that's what got implemented)
