/**
 * FILE: src/components/ui/Card.tsx
 * PURPOSE: White surface with the soft olive shadow. `interactive` cards rise and deepen
 *          their shadow on hover. Also exports <Reveal>, a one-off stagger-in wrapper used
 *          by page sections (index sets the delay).
 * WHERE USED: everywhere.
 */
import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> { interactive?: boolean; children?: ReactNode }

export function Card({ interactive, className, children, ...rest }: CardProps) {
  return (
    <motion.div
      whileHover={interactive ? { y: -4 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "w-full min-w-0 rounded-3xl border border-brand-200/70 bg-white/90 p-4 shadow-soft backdrop-blur sm:p-6",
        interactive && "cursor-pointer transition-shadow duration-300 hover:shadow-lift hover:border-brand-300",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, type: "spring", stiffness: 140, damping: 20 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold text-brand-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-xl text-brand-700">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
