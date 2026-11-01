/**
 * FILE: src/components/ui/Modal.tsx
 * PURPOSE: Dialog with blurred backdrop and a springy pop-in. Closes on Esc or backdrop click,
 *          locks page scroll while open. Used for confirmations (freeze, reject, reverse).
 * WHERE USED: admin pages.
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }

export function Modal({ open, onClose, title, description, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-lift"
          >
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-brand-600 transition hover:rotate-90 hover:bg-brand-100" aria-label="Close">
              <X className="size-5" />
            </button>
            <h2 className="pr-8 text-2xl font-semibold">{title}</h2>
            {description && <p className="mt-1.5 text-brand-700">{description}</p>}
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
