/**
 * FILE: src/pages/Transfer.tsx
 * PURPOSE
 *   Send money to another wallet in THREE steps, as the spec requires:
 *     1. Details   - receiver wallet number (live lookup shows WHO owns it), amount, note
 *     2. Confirm   - confirmation screen: receiver info, fee, total, balance after, daily limit
 *                    (data comes from POST /transfers/preview: nothing is saved yet)
 *     3. Done      - animated success
 *   The Idempotency-Key is created when the confirm screen opens and reused for retries, so a
 *   double click or flaky network can never send the money twice.
 * WHERE USED: route /transfer.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Send, ShieldAlert, UserX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Field, MoneyField } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import { FlowLine } from "../components/wallet/FlowLine";
import { SuccessBurst } from "../components/wallet/SuccessBurst";
import { useLimits, usePreviewTransfer, useReceiver, useTransfer, useWallet } from "../hooks/queries";
import { ApiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import { useIdempotencyKey } from "../lib/idempotency";
import { transferFormSchema, type TransferForm } from "../schemas";
import type { Transaction, TransferPreview } from "../types/api";
import { useAuth } from "../auth/AuthContext";

type Step = "details" | "confirm" | "done";
const slide = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { type: "spring" as const, stiffness: 260, damping: 28 } };

function ReceiverChip({ number }: { number: string }) {
  const valid = /^WAL-\d{4,12}$/.test(number);
  const q = useReceiver(number, valid);
  if (!valid) return null;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={q.status} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2">
        {q.isFetching ? <span className="flex items-center gap-2 text-sm text-brand-600"><Loader2 className="size-4 animate-spin" />Looking up wallet…</span>
          : q.data ? (
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${(q.data.status === "FROZEN" || q.data.can_receive === false) ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}>
              <CheckCircle2 className="size-4" />{q.data.name}{(q.data.status === "FROZEN" || q.data.can_receive === false) && " · unavailable, cannot receive"}
            </span>)
          : q.error ? <span className="inline-flex items-center gap-2 rounded-full bg-bad-soft px-3 py-1.5 text-sm font-semibold text-bad"><UserX className="size-4" />{(q.error as ApiError).message}</span> : null}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Transfer() {
  const { user } = useAuth();
  const wallet = useWallet();
  const limits = useLimits();
  const toast = useToast();
  const preview = usePreviewTransfer();
  const transfer = useTransfer();
  const idem = useIdempotencyKey();
  const [step, setStep] = useState<Step>("details");
  const [data, setData] = useState<TransferPreview | null>(null);
  const [form, setForm] = useState<TransferForm | null>(null);
  const [result, setResult] = useState<Transaction | null>(null);
  const [error, setError] = useState("");

  const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm<TransferForm>({
    resolver: zodResolver(transferFormSchema), defaultValues: { to_account_number: "", amount: "", note: "" },
  });
  const accountNumber = (watch("to_account_number") ?? "").trim().toUpperCase();

  const review = handleSubmit((v) => {
    setError("");
    preview.mutate({ to_account_number: v.to_account_number, amount: v.amount }, {
      onSuccess: (p) => { setData(p); setForm(v); idem.renew(); setStep("confirm"); },
      onError: (e) => setError(e instanceof ApiError ? e.message : "Could not check this transfer"),
    });
  });

  const send = () => {
    if (!form || !data?.can_receive) return;
    setError("");
    transfer.mutate({ to_account_number: form.to_account_number, amount: form.amount, note: form.note || undefined, key: idem.current() }, {
      onSuccess: (tx) => { setResult(tx); setStep("done"); toast.success("Transfer sent"); idem.renew(); },
      onError: (e) => { const m = e instanceof ApiError ? e.message : "Transfer failed"; setError(m); toast.error(m); },
    });
  };

  const startOver = () => { reset(); setForm(null); setData(null); setResult(null); setError(""); setStep("details"); };
  const steps: Step[] = ["details", "confirm", "done"];

  return (
    <>
      <PageHeader title="Send money" subtitle="Pay another wallet. You will review everything before it is sent." />
      <div className="mx-auto mb-5 flex max-w-xl items-center gap-2" aria-hidden>
        {steps.map((s, i) => (
          <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-200">
            <motion.div className="h-full rounded-full bg-brand-700" initial={false} animate={{ width: i <= steps.indexOf(step) ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
          </div>
        ))}
      </div>

      <Card className="mx-auto max-w-xl overflow-hidden !p-6 sm:!p-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === "details" && (
            <motion.form key="details" {...slide} onSubmit={review} className="space-y-5" noValidate>
              <div>
                <Field label="Receiver's wallet number" placeholder="WAL-100002" autoComplete="off" autoCapitalize="characters" error={errors.to_account_number?.message} {...register("to_account_number")} />
                <ReceiverChip number={accountNumber} />
              </div>
              <Controller control={control} name="amount" render={({ field }) => (
                <MoneyField label="Amount" value={field.value} onChange={field.onChange} error={errors.amount?.message}
                  hint={wallet.data && <>Available: <b>{formatMoney(wallet.data.available_balance)}</b>{limits.data && <> · fee {limits.data.transfer_fee_percent}%</>}</>} />
              )} />
              <Field label="Note (optional)" placeholder="What is it for?" error={errors.note?.message} {...register("note")} />
              {error && <p key={error} className="animate-shake rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad" role="alert">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={preview.isPending}>Review transfer</Button>
            </motion.form>
          )}

          {step === "confirm" && data && form && (
            <motion.div key="confirm" {...slide} className="space-y-5">
              <h2 className="text-2xl font-semibold">Confirm transfer</h2>
              <FlowLine fromName={user?.full_name ?? "You"} toName={data.receiver_name} toNumber={data.receiver_account_number} />
              <dl className="divide-y divide-brand-100 rounded-2xl bg-brand-50 px-5 text-[15px]">
                {[
                  ["Amount", formatMoney(data.amount)], ["Transfer fee", formatMoney(data.fee)], ["Total taken from you", formatMoney(data.total_debit)], ["Your balance after", formatMoney(data.balance_after)], ["Daily limit left after this", formatMoney(data.daily_remaining)], ...(form.note ? [["Note", form.note]] : []),
                ].map(([k, v], i) => (
                  <motion.div key={k} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }} className="flex justify-between gap-4 py-3">
                    <dt className="text-brand-700">{k}</dt><dd className={`tnum text-right font-semibold ${k === "Total taken from you" ? "font-display text-lg" : ""}`}>{v}</dd>
                  </motion.div>
                ))}
              </dl>
              {!data.can_receive && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">This wallet cannot receive transfers right now.</p>}
              {error && <p key={error} className="animate-shake flex gap-2 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad" role="alert"><ShieldAlert className="size-5 shrink-0" />{error}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => { setError(""); setStep("details"); }} icon={<ArrowLeft className="size-4" />}>Edit</Button>
                <Button className="flex-1" size="lg" loading={transfer.isPending} disabled={!data.can_receive} onClick={send} icon={<Send className="size-5" />}>Confirm and send</Button>
              </div>
            </motion.div>
          )}

          {step === "done" && result && (
            <motion.div key="done" {...slide} className="py-2 text-center">
              <SuccessBurst />
              <h2 className="mt-4 text-3xl font-semibold">Sent to {data?.receiver_name ?? "recipient"}</h2>
              <p className="tnum mt-2 font-display text-5xl font-semibold">{formatMoney(result.amount)}</p>
              <p className="mt-2 text-brand-700">Fee {formatMoney(result.fee)} · Reference {result.reference}</p>
              <div className="mt-7 flex justify-center gap-3">
                <Button variant="secondary" onClick={startOver}>Send another</Button>
                <Link to="/history"><Button>View history</Button></Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </>
  );
}
