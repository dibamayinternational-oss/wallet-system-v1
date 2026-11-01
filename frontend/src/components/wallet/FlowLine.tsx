/**
 * FILE: src/components/wallet/FlowLine.tsx
 * PURPOSE: Visual of a transfer on the confirmation screen: "You" -> "Receiver" with a glowing
 *          coin travelling along the line, so the user clearly sees WHO gets the money.
 * WHERE USED: Transfer page (review + success steps).
 */
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

function Node({ name, caption, delay }: { name: string; caption: string; delay: number }) {
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", delay }} className="flex w-20 min-w-0 flex-col items-center text-center sm:w-28">
      <div className="grid size-16 place-items-center rounded-2xl bg-brand-800 font-display text-xl font-semibold text-brand-50 shadow-lift">{initials(name)}</div>
      <p className="mt-2 max-w-full truncate text-sm font-semibold">{name}</p>
      <p className="text-xs text-brand-600">{caption}</p>
    </motion.div>
  );
}

export function FlowLine({ fromName, toName, toNumber, animateCoin = true }: { fromName: string; toName: string; toNumber: string; animateCoin?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <Node name={fromName} caption="You" delay={0} />
      <div className="relative h-16 flex-1">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-gradient-to-r from-brand-300 via-brand-500 to-brand-300" />
        {animateCoin && (
          <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-travel rounded-full bg-brand-700 shadow-[0_0_0_6px_rgb(140_169_255_/_0.35)]" />
        )}
        <ArrowRight className="absolute right-0 top-1/2 size-5 -translate-y-1/2 text-brand-600" />
      </div>
      <Node name={toName} caption={toNumber} delay={0.12} />
    </div>
  );
}
