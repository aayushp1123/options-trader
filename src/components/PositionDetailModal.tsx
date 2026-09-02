"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { PremiumChart, type ChartType, type OhlcPoint } from "@/components/PremiumChart";
import type { DisplayPosition } from "@/lib/bot/dashboardData";
import type { MarkPricePoint } from "@/lib/types";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface BarsResponse {
  points: MarkPricePoint[];
  ohlc: OhlcPoint[];
  live: boolean;
}

async function fetchBars(symbol: string): Promise<BarsResponse> {
  const res = await fetch(`/api/bot/bars?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("request failed");
  const data = await res.json();
  return { points: data.points ?? [], ohlc: data.ohlc ?? [], live: !!data.live };
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
  const [ohlc, setOhlc] = useState<OhlcPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);

  const [chartType, setChartType] = useState<ChartType>("line");
  const [compareInput, setCompareInput] = useState("");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  const [compareSeries, setCompareSeries] = useState<MarkPricePoint[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!position) return;
    setLoading(true);
    try {
      const data = await fetchBars(position.symbol);
      setSeries(data.points);
      setOhlc(data.ohlc);
      setLive(data.live);
    } catch {
      // leave prior state -- the "not enough history" fallback in PremiumChart covers empty state
    } finally {
      setLoading(false);
    }
  }, [position]);

  useEffect(() => {
    if (!open || !position) return;
    const id = setTimeout(() => {
      setChartType("line");
      setCompareTicker(null);
      setCompareSeries([]);
      setCompareInput("");
      setCompareError(null);
      load();
    }, 0);
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

  async function handleCompareSubmit(e: FormEvent) {
    e.preventDefault();
    const t = compareInput.trim().toUpperCase();
    if (!t) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const data = await fetchBars(t);
      if (data.points.length < 2) throw new Error("no data");
      setCompareSeries(data.points);
      setCompareTicker(t);
    } catch {
      setCompareError(`Couldn't load data for "${t}".`);
    } finally {
      setCompareLoading(false);
    }
  }

  function removeCompare() {
    setCompareSeries([]);
    setCompareTicker(null);
    setCompareInput("");
    setCompareError(null);
  }

  function handleChartTypeChange(type: ChartType) {
    setChartType(type);
    if (type !== "compare") removeCompare();
  }

  if (!open || !position) return null;

  const pl = parseFloat(position.unrealized_pl);
  const plPct = parseFloat(position.unrealized_plpc) * 100;
  const qty = parseFloat(position.qty);

  const isComparing = chartType === "compare" && compareSeries.length >= 2 && series.length >= 2;

  let compareRebasedPoints: MarkPricePoint[] = [];
  if (isComparing) {
    const primaryStart = series[0];
    const primaryStartTime = new Date(primaryStart.date).getTime();
    let basePoint = compareSeries[0];
    let bestDiff = Math.abs(new Date(basePoint.date).getTime() - primaryStartTime);
    for (const p of compareSeries) {
      const diff = Math.abs(new Date(p.date).getTime() - primaryStartTime);
      if (diff < bestDiff) {
        basePoint = p;
        bestDiff = diff;
      }
    }
    compareRebasedPoints = compareSeries
      .filter((p) => new Date(p.date).getTime() >= primaryStartTime)
      .map((p) => ({
        date: p.date,
        value: basePoint.value > 0 ? (p.value / basePoint.value) * primaryStart.value : primaryStart.value,
      }));
  }

  const periodHigh = ohlc.length ? Math.max(...ohlc.map((b) => b.high)) : null;
  const periodLow = ohlc.length ? Math.min(...ohlc.map((b) => b.low)) : null;
  const dayChangePct =
    series.length >= 2 ? ((series[series.length - 1].value - series[0].value) / series[0].value) * 100 : null;

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
        className={`flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-xl border border-line bg-paper-0 shadow-2xl transition-[max-width] duration-200 ${
          isComparing ? "max-w-6xl" : "max-w-3xl"
        }`}
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-ink-900">
              {position.symbol}
              {isComparing && ` vs ${compareTicker}`}
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    pl >= 0 ? "border-good-100 bg-good-100 text-good-800" : "border-crit-100 bg-crit-100 text-crit-800"
                  }`}
                >
                  {pl >= 0 ? "+" : ""}
                  {fmtMoney(pl)} ({pl >= 0 ? "+" : ""}
                  {plPct.toFixed(1)}%) unrealized
                </div>
                {dayChangePct !== null && (
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                      dayChangePct >= 0 ? "border-good-100 bg-good-100 text-good-800" : "border-crit-100 bg-crit-100 text-crit-800"
                    }`}
                  >
                    {dayChangePct >= 0 ? "+" : ""}
                    {dayChangePct.toFixed(2)}% this period
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-500">Quantity</p>
                <p className="text-lg font-bold text-ink-900">{Math.abs(qty)}</p>
              </div>
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-500">Avg Entry</p>
                <p className="text-lg font-bold text-ink-900">{fmtMoney(parseFloat(position.avg_entry_price))}</p>
              </div>
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-500">Period High</p>
                <p className="text-lg font-bold text-ink-900">{periodHigh !== null ? fmtMoney(periodHigh) : "—"}</p>
              </div>
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-xs font-semibold text-ink-500">Period Low</p>
                <p className="text-lg font-bold text-ink-900">{periodLow !== null ? fmtMoney(periodLow) : "—"}</p>
              </div>
            </div>

            <div className="rounded-lg border border-line p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-ink-900">Price</h3>
                {!live && <span className="text-xs font-semibold text-warn-600">Sandbox sample data</span>}
              </div>
              <PremiumChart
                series={
                  isComparing
                    ? [
                        { label: position.symbol, color: "var(--teal-600)", points: series, fill: true },
                        { label: `${compareTicker} (indexed)`, color: "var(--warn-600)", points: compareRebasedPoints, dashed: true },
                      ]
                    : [{ label: position.symbol, color: "var(--teal-600)", points: series, fill: true }]
                }
                ohlc={chartType === "candlestick" ? ohlc : undefined}
                showLegend={isComparing}
                showCompareOption
                chartType={chartType}
                onChartTypeChange={handleChartTypeChange}
              />

              {chartType === "compare" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {compareTicker ? (
                    <button
                      type="button"
                      onClick={removeCompare}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-crit-600 hover:text-crit-600"
                    >
                      Comparing to {compareTicker} &times;
                    </button>
                  ) : (
                    <form onSubmit={handleCompareSubmit} className="flex items-center gap-2">
                      <Input
                        value={compareInput}
                        onChange={(e) => setCompareInput(e.target.value.toUpperCase())}
                        placeholder="Compare with a symbol…"
                        className="w-40 py-1.5 text-xs"
                        maxLength={10}
                      />
                      <Button type="submit" variant="secondary" disabled={compareLoading || !compareInput} className="px-3 py-1.5 text-xs">
                        {compareLoading ? "Loading…" : "Compare"}
                      </Button>
                    </form>
                  )}
                  {compareError && <span className="text-xs text-crit-600">{compareError}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
