/**
 * FILE: src/components/wallet/SuccessBurst.tsx
 * PURPOSE: The "it worked" moment: a ring draws itself, the check mark strokes in, and small
 *          dots burst outward. Pure SVG + framer-motion, plays once when mounted.
 * WHERE USED: Deposit / Withdraw / Transfer success states. `tone="pending"` shows a clock
 *             for withdrawals that need approval.
 */
import { motion } from "framer-motion";

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const dist = 62 + (i % 3) * 16;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 3 + (i % 3) * 1.5 };
});

export function SuccessBurst({ tone = "success" }: { tone?: "success" | "pending" }) {
  const color = tone === "success" ? "var(--color-ok)" : "var(--color-warn)";
  return (
    <div className="relative mx-auto grid size-32 place-items-center">
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i} className="absolute rounded-full" style={{ width: p.size, height: p.size, background: i % 2 ? "var(--color-brand-500)" : color }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }} animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0, 1.2, 0.6] }}
          transition={{ duration: 0.9, delay: 0.35, ease: "easeOut" }}
        />
      ))}
      <motion.span className="absolute size-24 rounded-full" style={{ background: color, opacity: 0.12 }} initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ duration: 0.6 }} />
      <svg viewBox="0 0 52 52" className="relative size-24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <motion.circle cx="26" cy="26" r="23" initial={{ pathLength: 0, rotate: -90 }} animate={{ pathLength: 1 }} style={{ originX: "50%", originY: "50%", rotate: -90 }} transition={{ duration: 0.6, ease: "easeInOut" }} />
        {tone === "success" ? (
          <motion.path d="M15 27l8 8 14-16" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }} />
        ) : (
          <motion.path d="M26 14v13l8 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5 }} />
        )}
      </svg>
    </div>
  );
}
