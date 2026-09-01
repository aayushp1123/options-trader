"use client";

import { useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { PositionDetailModal } from "@/components/PositionDetailModal";
import type { DisplayPosition } from "@/lib/bot/dashboardData";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PositionsList({ positions }: { positions: DisplayPosition[] }) {
  const [selected, setSelected] = useState<DisplayPosition | null>(null);

  if (positions.length === 0) {
    return <p className="text-sm text-ink-500">No open positions right now.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {positions.map((p) => {
        const pl = parseFloat(p.unrealized_pl);
        const plPct = parseFloat(p.unrealized_plpc) * 100;
        return (
          <button
            key={p.asset_id}
            onClick={() => setSelected(p)}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-0 p-4 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-teal-600 hover:shadow-sm active:translate-y-0"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-heading)] text-base font-bold text-ink-900">
                  {p.symbol}
                </span>
                <Pill tone={p.side === "long" ? "neutral" : "warn"}>{p.side}</Pill>
                <Pill tone="neutral">{p.strategyLabel}</Pill>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {Math.abs(parseFloat(p.qty))} {p.asset_class === "crypto" ? "BTC" : "shares"} @{" "}
                {fmtMoney(parseFloat(p.avg_entry_price))}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-ink-900">{fmtMoney(parseFloat(p.market_value))}</p>
              <p className={`text-xs font-semibold ${pl >= 0 ? "text-good-600" : "text-crit-600"}`}>
                {pl >= 0 ? "+" : ""}
                {fmtMoney(pl)} ({pl >= 0 ? "+" : ""}
                {plPct.toFixed(1)}%)
              </p>
            </div>
          </button>
        );
      })}
      <PositionDetailModal position={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
