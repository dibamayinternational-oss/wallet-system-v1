/**
 * FILE: src/components/wallet/MoneyForm.tsx
 * PURPOSE
 *   One form component that powers BOTH the Deposit and Withdraw pages:
 *     amount (big input + quick chips) + optional note -> submit -> animated success state.
 *   Safety built in:
 *     - client validation (Zod) for instant feedback; server re-validates everything
 *     - one Idempotency-Key per attempt: double clicks / retries can never move money twice
 *     - withdraw: warns BEFORE submit when the amount needs admin approval or exceeds balance
 * WHERE USED: pages/Deposit.tsx and pages/Withdraw.tsx.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useDeposit, useWallet, useWithdraw } from "../../hooks/queries";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { useIdempotencyKey } from "../../lib/idempotency";
import { moneyFormSchema, type MoneyForm as Values } from "../../schemas";
import type { Transaction } from "../../types/api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { MoneyField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { SuccessBurst } from "./SuccessBurst";

const COPY = {
  deposit: { cta: "Deposit money", icon: ArrowDownToLine, chips: ["500", "1000", "5000", "10000"], noteLabel: "Note (optional)", notePh: "e.g. Salary top-up" },
  withdraw: { cta: "Withdraw money", icon: ArrowUpFromLine, chips: ["500", "1000", "5000", "10000"], noteLabel: "Note (optional)", notePh: "e.g. Rent" },
};

export function MoneyForm({ kind }: { kind: "deposit" | "withdraw" }) {
  const copy = COPY[kind];
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const mutation = kind === "deposit" ? deposit : withdraw;
  const wallet = useWallet();
  const toast = useToast();
  const idem = useIdempotencyKey();
  const [done, setDone] = useState<Transaction | null>(null);
  const [serverError, setServerError] = useState("");

  const { control, handleSubmit, watch, reset, setValue, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(moneyFormSchema), defaultValues: { amount: "", note: "" },
  });
  const amount = watch("amount");
  const num = Number(amount) || 0;
  const overBalance = kind === "withdraw" && wallet.data && num > Number(wallet.data.available_balance);
  const approvalLimit = 100000;
  const needsApproval = kind === "withdraw" && num > approvalLimit;

  const onSubmit = handleSubmit((v) => {
    setServerError("");
    if (overBalance) { setError("amount", { message: "That is more than your available balance" }); return; }
    mutation.mutate({ amount: v.amount, note: v.note || undefined, key: idem.current() }, {
      onSuccess: (tx) => { setDone(tx); idem.renew(); toast.success(tx.status === "PENDING" ? "Request sent for approval" : `${kind === "deposit" ? "Deposit" : "Withdrawal"} complete`); },
      onError: (e) => { const m = e instanceof ApiError ? e.message : "Something went wrong"; setServerError(m); toast.error(m); },
    });
  });

  return (
    <Card className="mx-auto max-w-xl !p-6 sm:!p-8">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
            <SuccessBurst tone={done.status === "PENDING" ? "pending" : "success"} />
            <h2 className="mt-4 text-3xl font-semibold">{done.status === "PENDING" ? "Waiting for approval" : kind === "deposit" ? "Money added" : "Money on its way out"}</h2>
            <p className="tnum mt-2 font-display text-5xl font-semibold">{formatMoney(done.amount)}</p>
            <p className="mx-auto mt-3 max-w-sm text-brand-700">
              {done.status === "PENDING" ? "Large withdrawals are reviewed by an admin. Your balance will not change until it is approved." : <>New balance <b>{wallet.data ? formatMoney(wallet.data.available_balance) : "…"}</b></>}
            </p>
            <p className="mt-1 text-sm text-brand-600">Reference {done.reference}</p>
            <div className="mt-7 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => { setDone(null); reset(); }}>Make another</Button>
              <Link to="/history"><Button>View history</Button></Link>
            </div>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={onSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="space-y-5" noValidate>
            <Controller control={control} name="amount" render={({ field }) => (
              <MoneyField label="Amount" value={field.value} onChange={(v) => { field.onChange(v); idem.renew(); }} error={errors.amount?.message} autoFocus
                hint={kind === "withdraw" && wallet.data ? <>Available: <b>{formatMoney(wallet.data.available_balance)}</b></> : undefined} />
            )} />
            <div className="flex flex-wrap gap-2">
              {copy.chips.map((c, i) => (
                <motion.button key={c} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }}
                  onClick={() => { setValue("amount", c, { shouldValidate: true }); idem.renew(); }}
                  className="rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-300">
                  {formatMoney(c).replace(/\.00$/, "")}
                </motion.button>
              ))}
            </div>

            {serverError && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{serverError}</p>}
            {kind === "withdraw" && num > 0 && (needsApproval ? <p role="status" className="rounded-xl border border-warn/30 bg-cream-200 px-4 py-3 text-sm font-medium text-warn">This amount is over the ৳{approvalLimit.toLocaleString("en-BD")} instant-withdrawal limit. It will be sent for admin approval.</p> : <p role="status" className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">Within the instant-withdrawal limit. This withdrawal can complete immediately.</p>)}
            <Button type="submit" size="lg" className="w-full" loading={mutation.isPending} icon={<copy.icon className="size-5" />}>
              {copy.cta}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </Card>
  );
}
