/**
 * FILE: src/pages/admin/AdminTransactions.tsx
 * PURPOSE: System-wide transaction list with filters (type, status, dates, search) and the
 *          REVERSE action. A reversal creates a NEW linked transaction with opposite ledger
 *          entries; the original is never modified. Reversed originals are marked, and a
 *          transaction can only be reversed once.
 * WHERE USED: route /admin/transactions.   DATA: useAdminTransactions, useReverse.
 */
import { motion } from "framer-motion";
import { ArrowLeftRight, ArrowRight, Link2, Search, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, statusTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { ReasonModal } from "../../components/ui/ReasonModal";
import { Segmented } from "../../components/ui/Segmented";
import { Skeleton } from "../../components/ui/Spinner";
import { NoteButton } from "../../components/wallet/NoteButton";
import { useToast } from "../../components/ui/Toast";
import { useAdminTransactions, useReverse } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { TYPE_LABEL, formatAmount, formatDateTime } from "../../lib/format";
import type { Transaction, TxType } from "../../types/api";

const TYPES: { value: TxType | ""; label: string }[] = [
  { value: "", label: "All" }, { value: "DEPOSIT", label: "Deposits" }, { value: "WITHDRAWAL", label: "Withdrawals" }, { value: "TRANSFER", label: "Transfers" }, { value: "REVERSAL", label: "Reversals" },
];
const inputCls = "h-10 rounded-xl border border-brand-200 bg-white px-3 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-300/40";

export default function AdminTransactions() {
  const [type, setType] = useState<TxType | "">("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Transaction | null>(null);
  const q = useAdminTransactions({ type, search: debounced, date_from: from || undefined, date_to: to || undefined, page });
  const reverse = useReverse();
  const toast = useToast();
  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  return (
    <>
      <PageHeader title="All transactions" subtitle="Everything that moved through the system. A completed transfer between members can be reversed with a linked, auditable entry." />
      {q.isError && <Card className="mb-4 !rounded-md !border-black !shadow-none"><p className="font-bold">Could not load transactions</p><p className="mt-1 text-sm">{q.error instanceof Error ? q.error.message : "Check your admin access and backend."}</p></Card>}
      <Card className="!p-0 overflow-hidden">
        <div className="space-y-3 border-b border-brand-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented value={type} onChange={(v) => { setType(v); setPage(1); }} options={TYPES} />
            <div className="flex items-center gap-2 text-sm">
              <input type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={inputCls} />
              <span className="text-brand-600">to</span>
              <input type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={inputCls} />
            </div>
          </div>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-brand-200 bg-white px-3.5 transition focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-300/40 sm:max-w-md">
            <Search className="size-4 text-brand-600" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, name or WAL number" className="w-full bg-transparent outline-none placeholder:text-brand-400" />
          </label>
        </div>

        <div className={cn("space-y-3 p-3 sm:p-4 transition-opacity", q.isFetching && !q.isLoading && "opacity-60")}>
          {q.isLoading && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
          {q.data?.items.map((t, i) => {
            // Only completed member-to-member transfers can be reversed.
            const canReverse = t.status === "COMPLETED" && t.type === "TRANSFER" && !t.is_reversed && !t.reversal_of;
            const fromName = t.type === "DEPOSIT" ? "System / Cash In" : t.type === "WITHDRAWAL" ? (t.from_account?.name ?? "Wallet owner") : (t.from_account?.name ?? "System");
            // const fromName = t.type === "DEPOSIT" ? `${t.from_account?.name}` : t.type === "WITHDRAWAL" ? (t.from_account?.name ?? "Wallet owner") : (t.from_account?.name ?? "System");
            // const fromEmail = t.type === "DEPOSIT" ? "System / Cash In" : t.type === "WITHDRAWAL" ? (t.from_account?.email ?? "") : (t.from_account?.email ?? "System");
            const toName = t.type === "WITHDRAWAL" ? "System / Cash Out" : t.type === "DEPOSIT" ? (t.to_account?.name ?? "Wallet owner") : (t.to_account?.name ?? "System");
            const fromWallet = t.type === "DEPOSIT" ? "System" : (t.from_account?.account_number ?? "—");
            const toWallet = t.type === "WITHDRAWAL" ? "System" : (t.to_account?.account_number ?? "—");
            return (
              <motion.article key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }} className={cn("min-w-0 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40 sm:p-5", t.type === "REVERSAL" && "bg-brand-50/60")}>
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={t.type === "REVERSAL" ? "dark" : "neutral"}>{TYPE_LABEL[t.type]}</Badge><Badge tone={statusTone(t.status)} dot>{t.status[0] + t.status.slice(1).toLowerCase()}</Badge></div>
                    <p className="mt-2 break-words font-mono text-xs text-brand-700">{t.reference}</p>
                    <p className="mt-1 text-xs text-brand-500">{formatDateTime(t.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum font-display text-xl font-semibold text-brand-950">{t.amount ? formatAmount(t.amount) : "—"}</p>
                    {Number(t.fee) > 0 && <p className="mt-0.5 text-xs text-brand-600">+{formatAmount(t.fee)} fee</p>}
                  </div>
                </div>

                <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
                  <div className="min-w-0 rounded-xl bg-brand-50 p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-500">From</p>
                    <p className="break-words text-sm font-semibold text-brand-950">{fromName}</p>
                    {/* <p className="break-words text-sm font-semibold text-brand-950">{fromEmail}</p> */}
                    <p className="mt-1 break-all font-mono text-xs text-brand-600">{fromWallet}</p>
                  </div>
                  <div className="flex items-center justify-center py-0.5 text-brand-400"><ArrowRight className="size-4 rotate-90 sm:rotate-0" /></div>
                  <div className="min-w-0 rounded-xl bg-brand-50 p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-500">To</p>
                    <p className="break-words text-sm font-semibold text-brand-950">{toName}</p>
                    <p className="mt-1 break-all font-mono text-xs text-brand-600">{toWallet}</p>
                  </div>
                </div>

                {(t.reversal_of || t.is_reversed || t.type !== "REVERSAL") && <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-brand-100 pt-3">
                  <div className="min-w-0 flex-1 text-xs">
                    {t.reversal_of && <p className="flex flex-wrap items-center gap-1 font-semibold text-brand-700"><Link2 className="size-3 shrink-0" />Original reference: <span className="break-all font-mono">{t.reversal_of}</span></p>}
                    {t.is_reversed && <p className="mt-1 flex items-center gap-1 font-semibold text-bad"><Undo2 className="size-3 shrink-0" />This transfer has been reversed</p>}
                    {t.type !== "REVERSAL" && <div className="mt-1"><NoteButton note={t.note} reason={t.decision_note} title={t.reference} /></div>}
                  </div>
                  {canReverse ? <Button size="sm" variant="secondary" icon={<Undo2 className="size-4" />} onClick={() => setTarget(t)}>Reverse transfer</Button> : t.type === "TRANSFER" && t.is_reversed ? <Badge tone="dark">Reversed</Badge> : null}
                </div>}
              </motion.article>
            );
          })}
        </div>
        {q.data?.items.length === 0 && <EmptyState icon={<ArrowLeftRight className="size-7" />} title="No transactions found" text="Adjust the filters to see more." />}
        <div className="px-5 pb-4">{q.data && <Pagination page={page} pageSize={q.data.page_size} total={q.data.total} onChange={setPage} />}</div>
      </Card>

      <ReasonModal open={!!target} onClose={() => setTarget(null)} danger title={`Reverse ${target?.reference ?? ""}?`}
        // description="The money (and the fee) goes back to the sender. This creates a new reversal transaction with opposite ledger entries; the original stays unchanged. It can only be done once, and only if the receiver still has the money."
        confirmLabel="Reverse transaction"
        onConfirm={async (reason) => { if (!target) return; await reverse.mutateAsync({ id: target.id, reason }); toast.success("Transaction reversed"); }} />
    </>
  );
}
