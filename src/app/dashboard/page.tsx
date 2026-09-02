import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { PositionsList } from "@/components/PositionsList";
import { PortfolioValueChartExpandable } from "@/components/PortfolioValueChartExpandable";
import { getDashboardData } from "@/lib/bot/dashboardData";
import { scanMarkets } from "@/lib/bot/scan";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DashboardPage() {
  const { account, positions, portfolioSeries, live } = await getDashboardData();
  const scan = live ? await scanMarkets().catch(() => null) : null;

  const equity = parseFloat(account.equity);
  const lastEquity = parseFloat(account.last_equity);
  const dayPl = equity - lastEquity;
  const dayPlPct = lastEquity !== 0 ? (dayPl / lastEquity) * 100 : 0;
  const totalUnrealized = positions.reduce((sum, p) => sum + parseFloat(p.unrealized_pl), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-wide text-teal-600">
            Options Desk
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
            Sandbox Account {account.account_number}
          </h1>
        </div>
        {!live && (
          <span className="flex-none rounded-full border border-warn-600/40 bg-warn-100 px-3 py-1.5 text-xs font-semibold text-warn-800">
            Sample data — set ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY to go live
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold text-ink-500">Portfolio Value</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{fmtMoney(equity)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-ink-500">Day P/L</p>
          <p className={`mt-1 text-xl font-bold ${dayPl >= 0 ? "text-good-600" : "text-crit-600"}`}>
            {dayPl >= 0 ? "+" : ""}
            {fmtMoney(dayPl)} ({dayPl >= 0 ? "+" : ""}
            {dayPlPct.toFixed(1)}%)
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-ink-500">Buying Power</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{fmtMoney(parseFloat(account.buying_power))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-ink-500">Open Positions Unrealized</p>
          <p className={`mt-1 text-xl font-bold ${totalUnrealized >= 0 ? "text-good-600" : "text-crit-600"}`}>
            {totalUnrealized >= 0 ? "+" : ""}
            {fmtMoney(totalUnrealized)}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Portfolio Value Over Time
        </h2>
        {portfolioSeries.length >= 2 ? (
          <PortfolioValueChartExpandable
            points={portfolioSeries}
            dashboard={{ totalValue: equity, asOf: new Date().toISOString(), portfolioSeries, positions }}
          />
        ) : (
          <p className="text-sm text-ink-500">Not enough history yet to chart.</p>
        )}
      </Card>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Open Positions — Bitcoin, Nasdaq (QQQ), S&amp;P 500 (SPY), Gold (GLD), Oil (USO)
        </h2>
        <PositionsList positions={positions} />
      </section>

      <section>
        <h2 className="mb-1 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          What The Bot Is Watching
        </h2>
        <p className="mb-3 text-sm text-ink-500">
          Live signal state for all 5 markets, refreshed on every page load — not just open positions.
        </p>
        {!scan ? (
          <Card>
            <p className="text-sm text-ink-500">
              {live ? "Couldn't load live signal state right now — try refreshing." : "Connect a live Alpaca account to see this."}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {scan.map((m) => (
              <Card key={m.symbol} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-heading)] text-base font-bold text-ink-900">
                      {m.symbol}
                    </span>
                    <Pill tone="neutral">{m.strategyLabel}</Pill>
                    {m.hasPosition && <Pill tone="good">In position</Pill>}
                    {!m.marketOpen && <Pill tone="warn">Market closed</Pill>}
                    {m.diagnostics?.wouldTrigger && (
                      <Pill tone={m.diagnostics.wouldTrigger === "long" ? "good" : "crit"}>
                        Would go {m.diagnostics.wouldTrigger}
                      </Pill>
                    )}
                  </div>
                  {m.diagnostics && (
                    <span className="text-sm font-semibold text-ink-900">
                      {fmtMoney(m.diagnostics.price)}
                    </span>
                  )}
                </div>
                {m.error ? (
                  <p className="mt-2 text-sm text-crit-600">{m.error}</p>
                ) : !m.marketOpen ? (
                  <p className="mt-2 text-sm text-ink-500">Waiting for the market to open — nothing to evaluate yet.</p>
                ) : m.diagnostics ? (
                  <>
                    <p className="mt-2 text-sm text-ink-700">{m.diagnostics.note}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.diagnostics.indicators.map((ind) => (
                        <Pill key={ind.label} tone={ind.status}>
                          {ind.label}: {ind.value}
                        </Pill>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-ink-500">Not enough history yet.</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-ink-500">
        {live
          ? "Live sandbox — connected to your Alpaca paper-trading account. Trades are placed automatically by the scheduled bot tick; no manual trigger."
          : "Sandbox / sample data — not yet connected to a live Alpaca paper-trading account."}
      </p>
    </div>
  );
}
