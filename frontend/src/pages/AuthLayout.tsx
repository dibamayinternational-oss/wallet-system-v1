/**
 * FILE: src/pages/AuthLayout.tsx
 * PURPOSE: Shared split-screen frame for Login and Register. The dark left panel has drifting
 *          blobs and a slowly scrolling "ledger" - every entry has a matching debit and credit,
 *          hinting at what the product guarantees. (Decorative only: aria-hidden.)
 * WHERE USED: Login.tsx, Register.tsx.
 */
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const ROWS = [
  ["Deposit", "Cash In", "Wallet", "5,000.00"], ["Transfer", "Wallet", "Wallet", "1,200.00"], ["Fee", "Wallet", "Fee Revenue", "6.00"],
  ["Withdrawal", "Wallet", "Cash Out", "800.00"], ["Reversal", "Wallet", "Wallet", "1,200.00"], ["Deposit", "Cash In", "Wallet", "350.00"],
];

function Ticker() {
  const list = [...ROWS, ...ROWS];
  return (
    <div className="relative h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]" aria-hidden>
      <div className="animate-marquee space-y-2">
        {list.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.1fr_1fr_1fr_.8fr] items-center gap-2 rounded-xl bg-brand-50/6 px-4 py-3 text-xs text-brand-200 ring-1 ring-brand-50/8 sm:text-sm">
            <span className="font-semibold text-brand-50">{r[0]}</span><span>− {r[1]}</span><span>+ {r[2]}</span><span className="tnum text-right font-semibold text-brand-300">{r[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative isolate hidden overflow-hidden bg-brand-900 p-12 text-brand-50 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-20 top-10 -z-10 size-96 animate-float rounded-full bg-brand-600/45 blur-3xl" />
        <div className="absolute -bottom-20 right-0 -z-10 size-[28rem] animate-float-slow rounded-full bg-brand-400/25 blur-3xl" />
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-400 text-brand-950"><svg viewBox="0 0 24 24" className="size-6" fill="currentColor"><path d="M4 7h16v3H4zM4 14h16v3H4z" /></svg></div>
          <span className="font-display text-2xl font-semibold">MayPay</span>
        </div>
        <div>
          <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="max-w-md font-display text-5xl font-semibold leading-[1.05]">
            Money that moves with a clear trail.
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-4 max-w-md text-lg text-brand-300">
            Deposits, withdrawals and transfers are written to a permanent double-entry ledger, so balances are always provable.
          </motion.p>
        </div>
        <Ticker />
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 18 }} className="w-full max-w-md">
          <h1 className="text-4xl font-semibold">{title}</h1>
          <p className="mb-8 mt-2 text-brand-700">{subtitle}</p>
          {children}
          <p className="mt-6 text-center text-sm text-brand-700">{footer}</p>
        </motion.div>
      </section>
    </div>
  );
}
