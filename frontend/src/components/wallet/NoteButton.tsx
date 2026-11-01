/**
 * FILE: src/components/wallet/NoteButton.tsx
 * PURPOSE
 *   A small note icon shown next to a transaction (not a table column, so a note can be any length):
 *     HOVER / keyboard focus -> a small floating preview of the note (or "No note")
 *     CLICK / tap            -> a modal with the full note (works on touch screens too)
 *   The icon is filled when a note exists and faded when there is none.
 *   The preview is drawn in a portal with fixed positioning so scrolling tables never clip it.
 * WHERE USED: History rows and the admin All-transactions table.
 * TAKES: note (what the member typed) and reason (admin reason for a reversal/rejection).
 */
import { motion } from "framer-motion";
import { StickyNote } from "lucide-react";
import { useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { Modal } from "../ui/Modal";

const W = 288; // preview width in px (18rem)

export function NoteButton({ note, reason, title = "Note" }: { note?: string | null; reason?: string | null; title?: string }) {
  const has = !!(note || reason);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [open, setOpen] = useState(false);
  const show = (e: SyntheticEvent<HTMLElement>) => setRect(e.currentTarget.getBoundingClientRect());
  const long = (note?.length ?? 0) > 140 || (reason?.length ?? 0) > 140;

  // place the preview under the icon, or above it when there is no room below
  const style = rect && {
    left: Math.min(Math.max(8, rect.left + rect.width / 2 - W / 2), window.innerWidth - W - 8),
    ...(rect.bottom + 170 > window.innerHeight ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
  };

  return (
    <>
      <button
        type="button" aria-label={has ? "View note" : "No note"}
        onMouseEnter={show} onFocus={show} onMouseLeave={() => setRect(null)} onBlur={() => setRect(null)}
        onClick={() => { setRect(null); setOpen(true); }}
        className={cn("grid size-7 shrink-0 place-items-center rounded-lg transition-all hover:scale-110", has ? "bg-cream-200 text-warn hover:bg-cream-300" : "text-brand-400 hover:bg-brand-100")}
      >
        <StickyNote className="size-4" />
      </button>

      {rect && style && createPortal(
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.12 }}
          style={{ position: "fixed", width: W, ...style }}
          className="pointer-events-none z-[60] rounded-2xl border border-brand-200 bg-white p-3.5 text-sm shadow-lift" role="tooltip"
        >
          {has ? (
            <div className="space-y-2">
              {note && <p className="line-clamp-5 whitespace-pre-wrap break-words text-brand-900">{note}</p>}
              {reason && <p className="line-clamp-3 whitespace-pre-wrap break-words text-brand-700"><b>Reason:</b> {reason}</p>}
              {long && <p className="text-xs font-semibold text-brand-600">Click to read it all</p>}
            </div>
          ) : (
            <p className="text-brand-600">No note</p>
          )}
        </motion.div>,
        document.body,
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {has ? (
          <div className="space-y-4">
            {note && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">Note</p><p className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-cream-100 p-4 text-brand-900">{note}</p></div>}
            {reason && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">Reason</p><p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-brand-50 p-4 text-brand-900">{reason}</p></div>}
          </div>
        ) : (
          <p className="rounded-2xl bg-brand-50 p-4 text-brand-700">No note was added to this transaction.</p>
        )}
      </Modal>
    </>
  );
}
