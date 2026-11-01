/**
 * FILE: src/components/wallet/BarChart.tsx
 * PURPOSE: Small paired bar chart (money in vs money out per day). Bars GROW from the baseline
 *          one after another, lift on hover, and show a tooltip with exact amounts. No chart
 *          library: ~60 lines of divs, so the bundle stays small.
 * WHERE USED: Dashboard (7-day cash flow), Admin overview (daily volume).
 * TAKES: rows [{label, a, b}] + legend names.
 */
import { motion } from "framer-motion";
import { useState } from "react";
import { formatMoney } from "../../lib/format";

export interface BarRow { label: string; a: number; b: number; c?: number }

export function BarChart({ rows, aLabel, bLabel, cLabel, height = 168 }: { rows: BarRow[]; aLabel: string; bLabel: string; cLabel?: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b, ...(cLabel ? [r.c ?? 0] : [])]));
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-brand-700">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-brand-700" />{aLabel}</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-brand-300" />{bLabel}</span>
        {cLabel && <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-gray-500" />{cLabel}</span>}
      </div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {rows.map((r, i) => (
          <div key={r.label} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} tabIndex={0}>
            {active === i && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="absolute -top-2 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-xl bg-brand-900 px-3 py-2 text-xs text-brand-50 shadow-lift">
                <p className="font-semibold">{aLabel}: {formatMoney(r.a)}</p>
                <p className="text-brand-300">{bLabel}: {formatMoney(r.b)}</p>
                {cLabel && <p className="text-green-800">{cLabel}: {formatMoney(r.c ?? 0)}</p>}
              </motion.div>
            )}
            <div className="flex h-full items-end justify-center gap-1">
              {[{ v: r.a, c: "bg-brand-700" }, { v: r.b, c: "bg-brand-300" }, ...(cLabel ? [{ v: r.c ?? 0, c: "bg-gray-500" }] : [])].map((bar, j) => (
                <motion.div
                  key={j}
                  className={`w-full max-w-5 rounded-t-lg ${bar.c} ${active === i ? "brightness-110" : ""}`}
                  initial={{ height: 0 }} animate={{ height: `${Math.max((bar.v / max) * 100, bar.v > 0 ? 4 : 1.5)}%` }}
                  transition={{ type: "spring", stiffness: 110, damping: 16, delay: 0.05 * i + j * 0.04 }}
                  style={{ opacity: bar.v > 0 ? 1 : 0.35 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {rows.map((r, i) => <span key={r.label} className={`flex-1 text-center text-xs ${active === i ? "font-bold text-brand-900" : "text-brand-600"}`}>{r.label}</span>)}
      </div>
    </div>
  );
}
