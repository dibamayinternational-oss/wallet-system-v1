/**
 * FILE: src/components/ui/Segmented.tsx
 * PURPOSE: Pill-style filter tabs (All / Deposit / Transfer ...). The highlighted pill GLIDES
 *          between options (shared layout animation) instead of jumping.
 * WHERE USED: History filters, admin pages, reports tabs.
 */
import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "../../lib/cn";

interface Props<T extends string> { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }

export function Segmented<T extends string>({ value, onChange, options, className }: Props<T>) {
  const id = useId();
  return (
    <div className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-brand-100 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={cn("relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors", o.value === value ? "text-brand-50" : "text-brand-700 hover:text-brand-900")}
        >
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-brand-800 shadow-soft" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
