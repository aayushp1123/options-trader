"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PremiumChart } from "@/components/PremiumChart";
import { Pill } from "@/components/ui/Pill";
import type { DisplayPosition } from "@/lib/bot/dashboardData";
import type { MarkPricePoint } from "@/lib/types";

export interface PortfolioDashboardData {
  totalValue: number;
  asOf: string;
  portfolioSeries: MarkPricePoint[];
  positions: DisplayPosition[];
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pctLabel(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Finds the series point closest to `daysAgo` days before the last point,
 * to compute a period return without needing a separate fetch per period --
 * the chart already has however much history is available. */
function returnOverDays(series: MarkPricePoint[], daysAgo: number | null): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const lastTime = new Date(last.date).getTime();
  const target = daysAgo === null ? -Infinity : lastTime - daysAgo * 86400000;

  let best = series[0];
  let bestDiff = Math.abs(new Date(best.date).getTime() - target);
  for (const p of series) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  if (best.value === 0) return null;
  return ((last.value - best.value) / best.value) * 100;
}

export function PortfolioDashboardModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: PortfolioDashboardData;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const returns = [
    { period: "1D", pct: returnOverDays(data.portfolioSeries, 1) },
    { period: "1W", pct: returnOverDays(data.portfolioSeries, 7) },
    { period: "1M", pct: returnOverDays(data.portfolioSeries, 30) },
    { period: "All", pct: returnOverDays(data.portfolioSeries, null) },
  ] as const;

  const ranked = [...data.positions].sort((a, b) => parseFloat(b.unrealized_plpc) - parseFloat(a.unrealized_plpc));
  const best = ranked.filter((p) => parseFloat(p.unrealized_plpc) >= 0).slice(0, 3);
  const worst = ranked
    .filter((p) => parseFloat(p.unrealized_plpc) < 0)
    .slice(-3)
    .reverse();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{ animation: "modal-backdrop-in 180ms ease-out", background: "var(--body-bg)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio dashboard"
    >
      <div
        className="flex h-[97vh] w-[98vw] max-w-5xl flex-col overflow-hidden rounded-xl border border-line bg-paper-0 shadow-2xl"
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">Portfolio Dashboard</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-3 py-2 text-lg leading-none text-ink-500 hover:bg-paper-50 hover:text-ink-900"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Total Portfolio Value</p>
              <p className="font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
                {fmtMoney(data.totalValue)}
              </p>
              <p className="mt-1 text-xs text-ink-500">As of {new Date(data.asOf).toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {returns.map((r) => (
                <div key={r.period} className="rounded-lg border border-line px-3 py-2.5">
                  <p className="text-xs font-semibold text-ink-500">{r.period}</p>
                  <p className={`text-lg font-bold ${r.pct == null ? "text-ink-500" : r.pct >= 0 ? "text-good-600" : "text-crit-600"}`}>
                    {pctLabel(r.pct)}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-line p-4">
              <PremiumChart
                series={[{ label: "Portfolio Value", color: "var(--teal-600)", points: data.portfolioSeries, fill: true }]}
                showLegend
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-ink-900">Best Performers</h3>
                {best.length === 0 ? (
                  <p className="text-sm text-ink-500">No positions currently up.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {best.map((p) => (
                      <div key={p.asset_id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-900">{p.symbol}</span>
                          <Pill tone="neutral">{p.strategyLabel}</Pill>
                        </div>
                        <span className="font-semibold text-good-600">{pctLabel(parseFloat(p.unrealized_plpc) * 100)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-ink-900">Worst Performers</h3>
                {worst.length === 0 ? (
                  <p className="text-sm text-ink-500">No positions currently down.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {worst.map((p) => (
                      <div key={p.asset_id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-900">{p.symbol}</span>
                          <Pill tone="neutral">{p.strategyLabel}</Pill>
                        </div>
                        <span className="font-semibold text-crit-600">{pctLabel(parseFloat(p.unrealized_plpc) * 100)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
