import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { isAlpacaConfigured } from "@/lib/alpaca/client";
import { getOrders } from "@/lib/alpaca/trading";
import type { Order } from "@/lib/alpaca/types";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function TradeLogPage() {
  if (!isAlpacaConfigured()) {
    return (
      <Card>
        <h1 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">Trade Log</h1>
        <p className="mt-2 text-sm text-ink-500">
          Set ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY to see real order history here — Alpaca&apos;s own order
          history is the source of truth, no separate database needed.
        </p>
      </Card>
    );
  }

  const orders: Order[] = await getOrders("all", 50);

  return (
    <Card>
      <h1 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">Trade Log</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-500">No orders yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">
                  {o.symbol}
                </span>
                <Pill tone={o.side === "buy" ? "neutral" : "warn"}>{o.side}</Pill>
                <Pill tone={o.status === "filled" ? "good" : o.status === "canceled" ? "crit" : "neutral"}>
                  {o.status}
                </Pill>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-900">
                  {o.qty ?? o.notional} {o.filled_avg_price ? `@ ${fmtMoney(parseFloat(o.filled_avg_price))}` : ""}
                </p>
                <p className="text-xs text-ink-500">{new Date(o.submitted_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
