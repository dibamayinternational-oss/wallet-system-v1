/**
 * FILE: src/components/wallet/WalletCard.tsx
 * PURPOSE
 *   The user's wallet drawn as a real payment card (credit-card proportions, 1.586 : 1):
 *     - chip + contactless mark, MayPay brand, status pill
 *     - balance rolls digit-by-digit when it changes; eye button hides/reveals it
 *     - wallet number with a copy button, card holder name
 *     - tilts in 3D toward the pointer with a spotlight that follows the cursor
 *   It never grows wider than a real card (max 27rem) however wide the screen is.
 * WHERE USED: Dashboard.   TAKES: Wallet (from useWallet).
 */
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check, Copy, Eye, EyeOff, Snowflake, Wifi } from "lucide-react";
import { useState } from "react";
import type { Wallet } from "../../types/api";
import { RollingNumber } from "../ui/RollingNumber";

export function WalletCard({ wallet }: { wallet: Wallet }) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [8, -8]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), { stiffness: 150, damping: 18 });
  const spot = useMotionTemplate`radial-gradient(320px circle at ${useTransform(px, (v) => v * 100)}% ${useTransform(py, (v) => v * 100)}%, rgb(255 242 198 / 0.24), transparent 62%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { px.set(0.5); py.set(0.5); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(wallet.account_number); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="w-full max-w-[27rem] [perspective:1100px]" onPointerMove={onMove} onPointerLeave={reset}>
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, y: 40, rotateX: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 90, damping: 16 }}
        className="relative isolate flex aspect-[1.586/1] w-full flex-col justify-between overflow-hidden rounded-[1.6rem] bg-brand-900 p-5 text-white shadow-lift ring-1 ring-white/10 sm:p-6"
      >
        {/* living background */}
        <div className="pointer-events-none absolute -left-10 -top-16 -z-10 size-52 animate-float rounded-full bg-brand-500/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-6 -z-10 size-56 animate-float-slow rounded-full bg-brand-400/30 blur-3xl" />
        <svg className="pointer-events-none absolute -right-8 -top-8 -z-10 size-52 text-brand-300/20" viewBox="0 0 200 200" fill="none" stroke="currentColor">
          {[30, 52, 74, 96].map((r, i) => (
            <motion.circle key={r} cx="100" cy="100" r={r} strokeWidth="1.2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 0.3 + i * 0.18 }} />
          ))}
        </svg>
        <motion.div className="pointer-events-none absolute inset-0 -z-10" style={{ background: spot }} />

        {/* top: chip + brand + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-11 overflow-hidden rounded-md bg-gradient-to-br from-cream-200 via-cream-400 to-cream-500 shadow-inner" aria-hidden>
              <span className="absolute inset-x-0 top-1/3 h-px bg-brand-900/25" /><span className="absolute inset-x-0 top-2/3 h-px bg-brand-900/25" />
              <span className="absolute inset-y-0 left-1/3 w-px bg-brand-900/25" /><span className="absolute inset-y-0 left-2/3 w-px bg-brand-900/25" />
            </div>
            <Wifi className="size-5 rotate-90 text-brand-300" aria-hidden />
          </div>
          <div className="flex items-center gap-2">
            {wallet.status === "FROZEN" ? (
              <span className="flex items-center gap-1 rounded-full bg-bad px-2.5 py-1 text-[11px] font-bold text-white"><Snowflake className="size-3" />Frozen</span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-brand-100">
                <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-ok" /><span className="relative inline-flex size-1.5 rounded-full bg-ok" /></span>Active
              </span>
            )}
            <span className="font-display text-lg font-semibold tracking-tight text-cream-200">MayPay</span>
          </div>
        </div>

        {/* middle: balance */}
        <div className="min-w-0">
          <p className="text-xs font-medium text-brand-300">Available balance</p>
          <div className="mt-1 flex min-w-0 items-center gap-2.5">
            <div className="relative h-[1.1em] min-w-[4ch] overflow-hidden font-display text-[clamp(1.75rem,7.5vw,2.5rem)] font-semibold leading-none">
              <AnimatePresence mode="wait" initial={false}>
                {hidden ? (
                  <motion.span key="h" initial={{ opacity: 0, filter: "blur(8px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(8px)" }} className="block tracking-widest text-brand-300">••••••</motion.span>
                ) : (
                  <motion.span key="v" initial={{ opacity: 0, filter: "blur(8px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(8px)" }} className="block"><RollingNumber value={wallet.available_balance} /></motion.span>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => setHidden((h) => !h)} className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-brand-200 transition hover:scale-110 hover:bg-white/20" aria-label={hidden ? "Show balance" : "Hide balance"}>
              {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
        </div>

        {/* bottom: wallet number + holder */}
        <div className="flex items-end justify-between gap-3" style={{ transform: "translateZ(24px)" }}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-brand-300">Wallet number</p>
            <button onClick={copy} className="group mt-0.5 flex items-center gap-1.5 font-display text-base font-semibold tracking-[0.18em] sm:text-lg" aria-label="Copy wallet number">
              {wallet.account_number}
              <span className="grid size-6 place-items-center rounded-md bg-white/10 transition group-hover:bg-white/20">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={copied ? "c" : "n"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                    {copied ? <Check className="size-3.5 text-cream-200" /> : <Copy className="size-3.5" />}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-widest text-brand-300">Holder</p>
            <p className="max-w-[9rem] truncate text-sm font-semibold">{wallet.name}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
