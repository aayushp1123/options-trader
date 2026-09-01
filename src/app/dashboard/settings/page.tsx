import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { isAlpacaConfigured } from "@/lib/alpaca/client";
import { getAccount } from "@/lib/alpaca/trading";
import { MARKETS } from "@/lib/bot/markets";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function SettingsPage() {
  const configured = isAlpacaConfigured();
  const account = configured ? await getAccount().catch(() => null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Read-only overview — strategy and risk parameters are set in code, not editable here, since there&apos;s
          no database backing this app on purpose (Alpaca&apos;s own account/positions/orders are the source of
          truth).
        </p>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">Alpaca Connection</h2>
          <Pill tone={configured && account ? "good" : "warn"}>{configured && account ? "Connected" : "Not connected"}</Pill>
        </div>
        {account ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold text-ink-500">Account</p>
              <p className="text-sm font-semibold text-ink-900">{account.account_number}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500">Equity</p>
              <p className="text-sm font-semibold text-ink-900">{fmtMoney(parseFloat(account.equity))}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500">Buying Power</p>
              <p className="text-sm font-semibold text-ink-900">{fmtMoney(parseFloat(account.buying_power))}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500">Mode</p>
              <p className="text-sm font-semibold text-ink-900">Paper</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            Set <code className="rounded bg-paper-50 px-1.5 py-0.5 text-xs">ALPACA_API_KEY_ID</code> and{" "}
            <code className="rounded bg-paper-50 px-1.5 py-0.5 text-xs">ALPACA_API_SECRET_KEY</code> in the
            environment to connect a real paper-trading account.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Markets &amp; Strategies
        </h2>
        <div className="flex flex-col divide-y divide-line">
          {MARKETS.map((m) => (
            <div key={m.symbol} className="flex items-center justify-between gap-3 py-2.5">
              <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
                {m.symbol}
              </span>
              <Pill tone="neutral">{m.strategyLabel}</Pill>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Risk Management
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-ink-700">
          <li>
            <span className="font-semibold text-ink-900">1% hard risk per trade.</span> Every position risks exactly
            1% of account equity, no exceptions — enforced by a real Alpaca bracket stop-loss attached at entry.
          </li>
          <li>
            <span className="font-semibold text-ink-900">ATR-based position sizing.</span> Stop distance is 1.5×
            ATR(14), recalculated every tick, so position size shrinks on volatile days and grows on calm ones while
            dollar risk stays fixed.
          </li>
          <li>
            <span className="font-semibold text-ink-900">Nasdaq/S&amp;P correlation filter.</span> A new long in QQQ
            is blocked if SPY is already long, and vice versa, to avoid doubling up on the same risk-on bet.
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">Scheduling</h2>
        <p className="text-sm text-ink-700">
          Fully automated — a GitHub Actions workflow calls <code className="rounded bg-paper-50 px-1.5 py-0.5 text-xs">/api/bot/tick</code> every
          15 minutes, 24/7. No manual &quot;run now&quot; button exists in this app; the tick endpoint itself decides
          what&apos;s actually due (equity markets check the real Alpaca market clock, Bitcoin runs on every tick
          since crypto trades around the clock).
        </p>
      </Card>
    </div>
  );
}
