/**
 * FILE: src/components/ui/Spinner.tsx
 * PURPOSE: Loading states: <FullScreenLoader> (app boot / auth check), <Skeleton> shimmer
 *          blocks (placeholder shapes while data loads, so the layout never jumps).
 * WHERE USED: ProtectedRoute, pages and tables.
 */
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

export function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-brand-50">
      <div className="relative grid size-16 place-items-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-400/50" />
        <motion.span
          className="size-9 rounded-xl bg-brand-800"
          animate={{ rotate: [0, 90, 180, 270, 360], borderRadius: ["12px", "50%", "12px"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-shimmer rounded-xl bg-[length:200%_100%] bg-gradient-to-r from-brand-100 via-brand-50 to-brand-100", className)}
      aria-hidden
    />
  );
}
