/**
 * FILE: src/components/ui/Toast.tsx
 * PURPOSE: Small slide-in notifications ("Deposit successful"). `useToast()` gives
 *          toast.success / toast.error / toast.info anywhere in the app.
 * WHERE USED: wrapped around the app in main.tsx; called from pages after mutations.
 */
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

type Kind = "success" | "error" | "info";
interface ToastItem { id: number; kind: Kind; message: string }
interface ToastApi { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }

const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

const STYLE: Record<Kind, { icon: typeof Info; bar: string; icon_cls: string }> = {
  success: { icon: CheckCircle2, bar: "bg-ok", icon_cls: "text-ok" },
  error: { icon: AlertCircle, bar: "bg-bad", icon_cls: "text-bad" },
  info: { icon: Info, bar: "bg-brand-600", icon_cls: "text-brand-700" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const id = ++counter;
    setItems((l) => [...l.slice(-3), { id, kind, message }]);
    setTimeout(() => remove(id), 5000);
  }, [remove]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const S = STYLE[t.kind];
            return (
              <motion.div
                key={t.id} layout
                initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }} transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border border-brand-200 bg-white py-3 pl-5 pr-3 shadow-lift"
                role="status"
              >
                <span className={cn("absolute inset-y-0 left-0 w-1.5", S.bar)} />
                <S.icon className={cn("mt-0.5 size-5 shrink-0", S.icon_cls)} />
                <p className="flex-1 text-sm font-medium text-brand-900">{t.message}</p>
                <button onClick={() => remove(t.id)} className="rounded-md p-1 text-brand-600 transition hover:bg-brand-100" aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
