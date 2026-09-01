import { Card } from "@/components/ui/Card";
import { PremiumChart } from "@/components/PremiumChart";
import { PositionsList } from "@/components/PositionsList";
import { getDashboardData } from "@/lib/bot/dashboardData";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DashboardPage() {
  const { account, positions, portfolioSeries, live } = await getDashboardData();

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
          <PremiumChart
            series={[{ label: "Portfolio Value", color: "var(--teal-600)", points: portfolioSeries, fill: true }]}
            defaultRange="1M"
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

      <p className="text-xs text-ink-500">
        {live
          ? "Live sandbox — connected to your Alpaca paper-trading account. Trades are placed automatically by the scheduled bot tick; no manual trigger."
          : "Sandbox / sample data — not yet connected to a live Alpaca paper-trading account."}
      </p>
    </div>
  );
}
