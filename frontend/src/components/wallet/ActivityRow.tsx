/**
 * FILE: src/components/wallet/ActivityRow.tsx
 * PURPOSE: One line of recent activity: coloured arrow (money in/out), what happened, when,
 *          signed amount. A soft highlight slides in on hover.
 * WHERE USED: Dashboard "Recent activity".  TAKES: a StatementLine.
 */
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, RotateCcw } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatAmount, formatDateTime } from "../../lib/format";
import type { StatementLine } from "../../types/api";

export function ActivityRow({ line, index }: { line: StatementLine; index: number }) {
  const incoming = line.credit !== null;
  const Icon = line.type === "REVERSAL" ? RotateCcw : incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <motion.li
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * index, type: "spring", stiffness: 160, damping: 20 }}
      whileHover={{ x: 4 }} className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-brand-50"
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6", incoming ? "bg-ok-soft text-ok" : "bg-brand-100 text-brand-800")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{line.description}</p>
        <p className="truncate text-sm text-brand-600">{formatDateTime(line.created_at)}</p>
      </div>
      <p className={cn("tnum font-display text-lg font-semibold", incoming ? "text-ok" : "text-brand-900")}>
        {incoming ? "+" : "−"}{formatAmount(line.credit ?? line.debit ?? "0")}
      </p>
    </motion.li>
  );
}
