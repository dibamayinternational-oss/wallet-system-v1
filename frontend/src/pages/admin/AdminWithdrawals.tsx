/**
 * FILE: src/pages/admin/AdminWithdrawals.tsx
 * PURPOSE: Approval queue for withdrawals above the limit. Approve = money leaves the wallet and
 *          is written to the ledger. Reject = nothing changes (reason saved). If the user has
 *          since spent the money, approval is refused by the server with a clear message.
 * WHERE USED: route /admin/withdrawals.   DATA: useAdminWithdrawals, useDecideWithdrawal.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Check, PartyPopper, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ReasonModal } from "../../components/ui/ReasonModal";
import { Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { useAdminWithdrawals, useDecideWithdrawal } from "../../hooks/queries";
import { ApiError } from "../../lib/api";
import { formatDateTime, formatMoney } from "../../lib/format";
import type { Transaction } from "../../types/api";

export default function AdminWithdrawals() {
  const q = useAdminWithdrawals();
  const decide = useDecideWithdrawal();
  const toast = useToast();
  const [rejecting, setRejecting] = useState<Transaction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const approve = (t: Transaction) => {
    setBusyId(t.id);
    decide.mutate({ id: t.id, action: "approve" }, {
      onSuccess: () => toast.success(`Approved ${formatMoney(t.amount)} for ${t.from_account?.name}`),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not approve"),
      onSettled: () => setBusyId(null),
    });
  };

  return (
    <>
      {/* <PageHeader title="Approvals" subtitle="Withdrawals above the approval limit wait here. The wallet balance does not change until you approve." /> */}
      <PageHeader title="Approvals" />
      {q.isError && <Card className="!rounded-md !border-black !shadow-none"><p className="font-bold">Could not load pending withdrawals</p><p className="mt-1 text-sm">{q.error instanceof Error ? q.error.message : "Check your admin access and backend."}</p></Card>}
      {q.isLoading && <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {q.data?.items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80, scale: 0.96 }} transition={{ type: "spring", stiffness: 220, damping: 26 }}>
              <Card className="flex flex-wrap items-center gap-5">
                <div className="min-w-48 flex-1">
                  <p className="text-sm text-brand-600">{formatDateTime(t.created_at)} · {t.reference}</p>
                  <p className="mt-0.5 text-lg font-semibold">{t.from_account?.name}</p>
                  <p className="font-mono text-sm text-brand-700">{t.from_account?.account_number}</p>
                  {t.note && <p className="mt-1 text-sm italic text-brand-700">“{t.note}”</p>}
                </div>
                <p className="tnum font-display text-4xl font-semibold">BDT {t.amount}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" icon={<X className="size-4" />} disabled={busyId === t.id} onClick={() => setRejecting(t)}>Reject</Button>
                  <Button icon={<Check className="size-4" />} loading={busyId === t.id} onClick={() => approve(t)}>Approve</Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {q.data?.items.length === 0 && <Card><EmptyState icon={<PartyPopper className="size-7" />} title="All caught up" text="No withdrawals are waiting for approval." /></Card>}

      <ReasonModal open={!!rejecting} onClose={() => setRejecting(null)} danger title="Reject this withdrawal?" description={rejecting ? `${formatMoney(rejecting.amount)} for ${rejecting.from_account?.name}. Their balance stays unchanged.` : undefined}
        confirmLabel="Reject withdrawal" onConfirm={async (reason) => { if (!rejecting) return; await decide.mutateAsync({ id: rejecting.id, action: "reject", reason }); toast.info("Withdrawal rejected"); }} />
    </>
  );
}
