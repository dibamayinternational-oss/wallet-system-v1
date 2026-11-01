/**
 * FILE: src/pages/admin/AdminAccounts.tsx
 * PURPOSE: All user wallets with balances. Search by name/email/wallet number, filter by status,
 *          freeze / unfreeze (frozen wallets cannot send or receive money). Every change is
 *          written to the audit log together with the reason.
 * WHERE USED: route /admin/accounts.   DATA: useAdminAccounts, useSetFrozen.
 */
import { motion } from "framer-motion";
import { Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, statusTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { ReasonModal } from "../../components/ui/ReasonModal";
import { Segmented } from "../../components/ui/Segmented";
import { Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { useAdminAccounts, useSetFrozen } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { formatAmount, formatDate } from "../../lib/format";
import type { AdminAccount } from "../../types/api";

export default function AdminAccounts() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminAccount | null>(null);
  const toast = useToast();
  const setFrozen = useSetFrozen();
  const q = useAdminAccounts({ search: debounced, status, page });

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  return (
    <>
      {/* <PageHeader title="Accounts" subtitle="Every wallet and its balance. Freeze a wallet to stop it sending or receiving money." /> */}
      <PageHeader title="Accounts"  />
      {q.isError && <Card className="mb-4 !rounded-md !border-black !shadow-none"><p className="font-bold">Could not load accounts</p><p className="mt-1 text-sm">{q.error instanceof Error ? q.error.message : "Check your admin access and backend."}</p></Card>}
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 p-4 sm:p-5">
          <label className="flex h-11 min-w-64 flex-1 items-center gap-2 rounded-xl border border-brand-200 bg-white px-3.5 transition focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-300/40 sm:max-w-sm">
            <Search className="size-4 text-brand-600" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or WAL number" className="w-full bg-transparent outline-none placeholder:text-brand-400" />
          </label>
          <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "", label: "All" }, { value: "ACTIVE", label: "Active" }, { value: "FROZEN", label: "Frozen" }]} />
        </div>
        <div className={cn("overflow-x-auto transition-opacity", q.isFetching && !q.isLoading && "opacity-60")}>
          <table className="w-full min-w-[760px] text-left text-[15px]">
            <thead className="bg-brand-50 text-sm text-brand-700"><tr>{["Owner", "Wallet", "Balance", "Status", "Joined", ""].map((h, i) => <th key={i} className={cn("px-5 py-3 font-semibold", i === 2 && "text-right")}>{h}</th>)}</tr></thead>
            <tbody>
              {q.isLoading && [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={6} className="px-5 py-2"><Skeleton className="h-12" /></td></tr>)}
              {q.data?.items.map((a, i) => (
                <motion.tr key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }} className="border-t border-brand-100 transition-colors hover:bg-brand-50">
                  <td className="px-5 py-3.5"><p className="font-semibold">{a.name}</p><p className="text-sm text-brand-600">{a.email}</p></td>
                  <td className="px-5 py-3.5 font-mono text-sm">{a.account_number}</td>
                  <td className="tnum px-5 py-3.5 text-right font-display text-lg font-semibold">{formatAmount(a.balance)}</td>
                  <td className="px-5 py-3.5"><Badge tone={statusTone(a.status)} dot>{a.status === "ACTIVE" ? "Active" : "Frozen"}</Badge>{a.role === "ADMIN" && <Badge tone="dark" className="ml-2">Admin</Badge>}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-brand-700">{formatDate(a.created_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Button size="sm" variant={a.status === "ACTIVE" ? "secondary" : "primary"} onClick={() => setTarget(a)}>
                      {a.status === "ACTIVE" ? "Freeze" : "Unfreeze"}
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {q.data?.items.length === 0 && <EmptyState icon={<Users className="size-7" />} title="No accounts found" text="Try a different search or filter." />}
        <div className="px-5 pb-4">{q.data && <Pagination page={page} pageSize={q.data.page_size} total={q.data.total} onChange={setPage} />}</div>
      </Card>

      <ReasonModal
        open={!!target} onClose={() => setTarget(null)} required={false} danger={target?.status === "ACTIVE"}
        title={target?.status === "ACTIVE" ? `Freeze ${target.name}?` : `Unfreeze ${target?.name}?`}
        description={target?.status === "ACTIVE" ? "A frozen wallet cannot send, receive, deposit or withdraw money." : "The wallet will be able to move money again."}
        confirmLabel={target?.status === "ACTIVE" ? "Freeze wallet" : "Unfreeze wallet"}
        onConfirm={async (reason) => { if (!target) return; await setFrozen.mutateAsync({ id: target.id, freeze: target.status === "ACTIVE", reason: reason || undefined }); toast.success(target.status === "ACTIVE" ? "Wallet frozen" : "Wallet unfrozen"); }}
      />
    </>
  );
}
