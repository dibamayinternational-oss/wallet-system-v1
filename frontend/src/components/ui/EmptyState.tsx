/**
 * FILE: src/components/ui/EmptyState.tsx
 * PURPOSE: Friendly "nothing here yet" panel with a gently floating icon and an optional action.
 * WHERE USED: empty tables / lists.
 */
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4 grid size-16 place-items-center rounded-2xl bg-brand-100 text-brand-700">{icon}</motion.div>
      <h3 className="text-xl font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-brand-700">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
