/**
 * FILE: src/pages/Limits.tsx
 * PURPOSE
 *   "Limits & fees": everything a member needs to know about the rules on their wallet, always the
 *   CURRENT values (admins can change them at any time):
 *     - daily transfer limit with a live "used today / left" bar
 *     - withdrawal approval threshold (instant up to X, approval above X)
 *     - maximum per transaction
 *     - transfer fee (percent, minimum, maximum) + a small calculator
 * WHERE USED: route /info (menu item after History).   DATA: useLimits.
 * NOTE: the calculator is an ESTIMATE shown for convenience; the real fee is computed by the server.
 */
import { motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine, CalendarClock, Calculator, ChevronDown, Percent, Send } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card, PageHeader, Reveal } from "../components/ui/Card";
import { MoneyField } from "../components/ui/Field";
import { Skeleton } from "../components/ui/Spinner";
import { useLimits } from "../hooks/queries";
import { cn } from "../lib/cn";
import { formatMoney } from "../lib/format";

/** Same formula as the server: percent of amount, clamped to [min, max], rounded half-up to cents. */
function estimateFee(amount: number, pct: number, min: number, max: number): number {
  const cents = Math.round(Math.round(amount * 100) * pct / 100);
  return Math.min(Math.max(cents / 100, min), max);
}

function Tile({ icon, title, children, index }: { icon: ReactNode; title: string; children: ReactNode; index: number }) {
  return (
    <Reveal index={index} className="min-w-0">
      <Card interactive className="h-full">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-800 text-brand-50">{icon}</span>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {children}
      </Card>
    </Reveal>
  );
}

export default function Limits() {
  const { data: l } = useLimits();
  const [amount, setAmount] = useState("1000");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  if (!l) {
    return <><PageHeader title="Limits & fees" /><div className="grid gap-5 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}</div></>;
  }

  const limit = Number(l.daily_transfer_limit);
  const used = Number(l.daily_used);
  const pct = Math.min(100, limit ? (used / limit) * 100 : 0);
  const hot = pct >= 80;
  const n = Number(amount) || 0;
  const fee = n > 0 ? estimateFee(n, Number(l.transfer_fee_percent), Number(l.transfer_fee_min), Number(l.transfer_fee_max)) : 0;

  return (
    <>
      <PageHeader title="Limits & fees" subtitle="The rules that apply to your wallet. They can be updated by the administrators, and this page always shows the current ones." />

      <div className="grid gap-5 md:grid-cols-2">
        <Tile index={0} icon={<CalendarClock className="size-5" />} title="Daily transfer limit">
          <p className="tnum font-display text-4xl font-semibold">{formatMoney(l.daily_remaining)}</p>
          <p className="text-brand-700">left to send today, out of {formatMoney(l.daily_transfer_limit)}</p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Daily limit used">
            <motion.div className={cn("h-full rounded-full", hot ? "bg-warn" : "bg-brand-500")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.2 }} />
          </div>
          <div className="mt-2 flex justify-between text-sm text-brand-600"><span>Used today: {formatMoney(l.daily_used)}</span><span>{Math.round(pct)}%</span></div>
          <p className="mt-4 text-sm text-brand-600">The allowance counts transfers you send (not the fee) and resets every day at midnight.</p>
        </Tile>

        <Tile index={1} icon={<ArrowUpFromLine className="size-5" />} title="Withdrawals">
          <p className="text-brand-700">Withdrawals up to</p>
          <p className="tnum font-display text-4xl font-semibold">{formatMoney(l.withdrawal_approval_limit)}</p>
          <p className="mt-1 text-brand-700">complete instantly.</p>
          <div className="mt-4 rounded-2xl bg-cream-200 p-4 text-sm font-medium text-warn">
            Anything above that needs an administrator&apos;s approval. Your balance does not change until it is approved.
          </div>
        </Tile>

      </div>

      <Reveal index={2} className="mt-5">
        <Card>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-800 text-brand-50"><Percent className="size-5" /></span>
              <div>
                <h2 className="text-xl font-semibold">Transfer fee</h2>
                <p className="text-brand-700"><b>{Number(l.transfer_fee_percent)}%</b> of the amount you send, never less than <b>{formatMoney(l.transfer_fee_min)}</b> and never more than <b>{formatMoney(l.transfer_fee_max)}</b>.</p>
              </div>
            </div>
            <ul className="space-y-1.5 text-sm text-brand-700">
              <li className="flex items-center gap-2"><ArrowDownToLine className="size-4 text-brand-600" />Deposits are free</li>
              <li className="flex items-center gap-2"><ArrowUpFromLine className="size-4 text-brand-600" />Withdrawals are free</li>
              <li className="flex items-center gap-2"><Send className="size-4 text-brand-600" />Transfers to other wallets carry the fee</li>
            </ul>
          </div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-800"><Calculator className="size-4" />Fee calculator </div>
          <div className="grid items-start gap-5 md:grid-cols-2">
            <MoneyField label="Amount to send" value={amount} onChange={setAmount} />
            <dl className="divide-y divide-brand-100 rounded-2xl bg-brand-50 px-5 text-[15px]">
              {[["Amount", formatMoney(n)], ["Fee", formatMoney(fee)], ["Total taken from you", formatMoney(n + fee)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-brand-700">{k}</dt><dd className={cn("tnum font-semibold", k === "Total taken from you" && "font-display text-lg")}>{v}</dd></div>
              ))}
            </dl>
          </div>
        </Card>
      </Reveal>

      <Reveal index={3} className="mt-5">
        <Card>
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <p className="mb-3 mt-1 text-sm text-brand-600">Quick answers about wallet limits, fees and transfers.</p>
          <div className="divide-y divide-brand-100">
            {[
              ["Why can my available balance be lower than the balance shown on my wallet?", "A pending withdrawal can reserve funds before it is approved or rejected. Reserved money is still part of the wallet balance, but it cannot be spent while the request is pending."],
              ["What happens to the fee and history if a transfer is reversed?", "A reversal is recorded as a separate linked transaction; the original transfer remains in your history. The reversal process also accounts for the original transfer fee, subject to the backend's reversal checks."],
              ["Why might a transfer be rejected even when I have enough money?", "The recipient wallet must be able to receive money, your wallet must be active, and the transfer must pass transaction and daily-limit checks. A frozen wallet cannot send or receive transfers."],
              ["How is the amount deducted from my wallet calculated?", "The amount you enter is the amount sent to the recipient. Your wallet is debited by that amount plus the transfer fee shown on the confirmation screen."],
              ["What should I do if the recipient details are correct but a transfer fails?", "Do not immediately submit repeated attempts. Check your transaction history first for a completed transaction, then retry only if no transaction was recorded. If it keeps failing, contact the administrator with the reference or error details."],
            ].map(([question, answer], i) => <div key={question} className="py-1">
              <button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-3 text-left font-semibold text-brand-900">
                <span>{question}</span><ChevronDown className={cn("size-5 shrink-0 transition-transform", openFaq === i && "rotate-180")} />
              </button>
              {openFaq === i && <p className="max-w-3xl pb-4 pr-8 text-sm leading-6 text-brand-700">{answer}</p>}
            </div>)}
          </div>
        </Card>
      </Reveal>
    </>
  );
}
