/**
 * FILE: src/pages/History.tsx
 * PURPOSE
 *   Account statement built from the LEDGER: date, type, reference, debit, credit and
 *   running balance, newest first, with date-range + type filters and pagination.
 *   Pending withdrawals (no ledger lines yet) are listed above so nothing is "invisible".
 * WHERE USED: route /history.   DATA: useStatement, useMyTransactions.
 */
import { motion } from "framer-motion";
import { Hourglass, ReceiptText } from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Card, PageHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Pagination } from "../components/ui/Pagination";
import { Segmented } from "../components/ui/Segmented";
import { Skeleton } from "../components/ui/Spinner";
import { NoteButton } from "../components/wallet/NoteButton";
import { useMyTransactions, useStatement } from "../hooks/queries";
import { cn } from "../lib/cn";
import { TYPE_LABEL, formatAmount, formatDateTime, formatMoney } from "../lib/format";
import type { TxType } from "../types/api";

import { StatementDownload } from "../components/wallet/StatementDownload";

const TYPES: { value: TxType | ""; label: string }[] = [
  { value: "", label: "All" }, { value: "DEPOSIT", label: "Deposits" }, { value: "WITHDRAWAL", label: "Withdrawals" },
  { value: "TRANSFER", label: "Transfers" },{ value: "REVERSAL", label: "Reversals" },
];

export default function History() {
  const [type, setType] = useState<TxType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const stmt = useStatement({ type, date_from: from ? `${from}T00:00:00Z` : undefined, date_to: to ? `${to}T23:59:59Z` : undefined, page });
  const pending = useMyTransactions("PENDING");
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <>
      <PageHeader title="History" subtitle="Every movement of money in your wallet, with the running balance after each one." action={<StatementDownload initialFrom={from || undefined} initialTo={to || undefined} />} />

      {!!pending.data?.items.length && (
        <Card className="mb-5 !border-warn/30 !bg-warn-soft/60">
          <p className="mb-3 flex items-center gap-2 font-semibold text-warn"><Hourglass className="size-5" />Waiting for approval</p>
          {pending.data.items.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-t border-warn/15 py-2.5 first:border-0">
              <div><p className="font-semibold">Withdrawal {formatMoney(t.amount)}</p><p className="text-sm text-brand-700">{t.reference} · {formatDateTime(t.created_at)}</p></div>
              <Badge tone="warn" dot>Pending</Badge>
            </div>
          ))}
        </Card>
      )}

      {stmt.isError && <Card className="mb-4 !border-bad/30 !bg-bad-soft"><p className="font-semibold text-bad">Could not load transaction history.</p><p className="mt-1 text-sm text-bad">{stmt.error instanceof Error ? stmt.error.message : "Please try again."}</p></Card>}
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 p-4 sm:p-5">
          <Segmented value={type} onChange={reset(setType)} options={TYPES} />
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} aria-label="From date" className="h-10 rounded-xl border border-brand-200 bg-white px-3 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-300/40" />
            <span className="text-brand-600">to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} aria-label="To date" className="h-10 rounded-xl border border-brand-200 bg-white px-3 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-300/40" />
          </div>

        </div>

        <div className={cn("overflow-x-auto transition-opacity", stmt.isFetching && !stmt.isLoading && "opacity-60")}>
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="bg-brand-50 text-sm text-brand-700">
              <tr>{["Date", "Details", "Reference", "Debit", "Credit", "Balance"].map((h, i) => <th key={h} className={cn("px-5 py-3 font-semibold", i >= 3 && "text-right")}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {stmt.isLoading && [0, 1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={6} className="px-5 py-2"><Skeleton className="h-10" /></td></tr>)}
              {stmt.data?.items.map((l, i) => (
                <motion.tr key={l.entry_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.025 * i }} className="border-t border-brand-100 transition-colors hover:bg-brand-50">
                  <td className="whitespace-nowrap px-5 py-3.5 text-brand-700">{formatDateTime(l.created_at)}</td>
                  <td className="px-5 py-3.5"><p className="font-semibold">{l.description}</p>{l.type === "TRANSFER" && Number(l.fee ?? 0) > 0 && <p className="mt-1 text-xs font-medium text-brand-600">Transfer fee: {formatMoney(l.fee!)}</p>}<div className="mt-1 flex items-center gap-2"><Badge>{TYPE_LABEL[l.type]?.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) ?? l.type}</Badge><NoteButton note={l.note} reason={l.reason} title={l.description} /></div></td>
                  <td className="max-w-[140px] px-5 py-3.5 font-mono text-xs leading-5 text-brand-600"><span className="break-all">{l.reference}</span></td>
                  {/* <td className="px-5 py-3.5 font-mono text-xs text-brand-600">{l.fee}</td> */}
                  <td className="tnum px-5 py-3.5 text-right font-semibold text-bad">{l.debit ? formatAmount(l.debit) : ""}</td>
                  <td className="tnum px-5 py-3.5 text-right font-semibold text-ok">{l.credit ? formatAmount(l.credit) : ""}</td>
                  <td className="tnum px-5 py-3.5 text-right font-display font-semibold">{formatAmount(l.balance)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {stmt.data && stmt.data.items.length === 0 && <EmptyState icon={<ReceiptText className="size-7" />} title="Nothing matches" text="Try a different date range or type." />}
        <div className="px-5 pb-4">{stmt.data && <Pagination page={page} pageSize={stmt.data.page_size} total={stmt.data.total} onChange={setPage} />}</div>
      </Card>
    </>
  );
}
