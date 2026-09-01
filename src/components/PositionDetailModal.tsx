"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { PremiumChart } from "@/components/PremiumChart";
import type { DisplayPosition } from "@/lib/bot/dashboardData";
import type { MarkPricePoint } from "@/lib/types";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PositionDetailModal({
  position,
  open,
  onClose,
}: {
  position: DisplayPosition | null;
  open: boolean;
  onClose: () => void;
}) {
  const [series, setSeries] = useState<MarkPricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    if (!position) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bot/bars?symbol=${encodeURIComponent(position.symbol)}`);
      const data = await res.json();
      setSeries(data.points ?? []);
      setLive(!!data.live);
    } finally {
      setLoading(false);
    }
  }, [position]);

  useEffect(() => {
    if (!open || !position) return;
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [open, position, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !position) return null;

  const pl = parseFloat(position.unrealized_pl);
  const plPct = parseFloat(position.unrealized_plpc) * 100;
  const qty = parseFloat(position.qty);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{ animation: "modal-backdrop-in 180ms ease-out", background: "var(--body-bg)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${position.symbol} position details`}
    >
      <div
        className="flex h-[95vh] w-[95vw] max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-paper-0 shadow-2xl"
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">
              {position.symbol}
            </h2>
            <Pill tone={position.side === "long" ? "neutral" : "warn"}>{position.side === "long" ? "Long" : "Short"}</Pill>
            <Pill tone="neutral">{position.strategyLabel}</Pill>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-3 py-2 text-lg leading-none text-ink-500 hover:bg-paper-50 hover:text-ink-900"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-paper-50 to-paper-0 p-6 shadow-sm">
              <p className="font-[family-name:var(--font-heading)] text-4xl font-bold text-ink-900">
                {fmtMoney(parseFloat(position.current_price))}
              </p>
              <div
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  pl >= 0 ? "border-good-100 bg-good-100 text-good-800" : "border-crit-100 bg-crit-100 text-crit-800"
                }`}
              >
                {pl >= 0 ? "+" : ""}
                {fmtMoney(pl)} ({pl >= 0 ? "+" : ""}
                {plPct.toFixed(1)}%) unrealized
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-500">Quantity</p>
                <p className="text-lg font-bold text-ink-900">{Math.abs(qty)}</p>
              </div>
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-500">Avg Entry</p>
                <p className="text-lg font-bold text-ink-900">{fmtMoney(parseFloat(position.avg_entry_price))}</p>
              </div>
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-500">Market Value</p>
                <p className="text-lg font-bold text-ink-900">{fmtMoney(parseFloat(position.market_value))}</p>
              </div>
            </div>

            <div className="rounded-lg border border-line p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">Price</h3>
                {!live && (
                  <span className="text-xs font-semibold text-warn-600">Sandbox sample data</span>
                )}
              </div>
              {series.length >= 2 ? (
                <PremiumChart
                  series={[{ label: position.symbol, color: "var(--teal-600)", points: series, fill: true }]}
                  defaultRange="1M"
                />
              ) : (
                <p className="text-sm text-ink-500">{loading ? "Loading…" : "Not enough history yet to chart."}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
