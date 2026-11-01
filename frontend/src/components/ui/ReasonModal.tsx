/**
 * FILE: src/components/ui/ReasonModal.tsx
 * PURPOSE: Reusable confirmation dialog that asks for a short reason (rejecting a withdrawal,
 *          reversing a transaction, freezing an account). The reason is stored in the audit trail.
 * WHERE USED: admin pages.
 * TAKES: texts + onConfirm(reason) returning a Promise (modal shows loading, closes on success).
 */
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { ApiError } from "../../lib/api";

interface Props {
  open: boolean; onClose: () => void; title: string; description?: string; confirmLabel: string;
  danger?: boolean; required?: boolean; placeholder?: string; onConfirm: (reason: string) => Promise<unknown>;
}

export function ReasonModal({ open, onClose, title, description, confirmLabel, danger, required = false, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason(""); setError(""); } }, [open]);

  const submit = async () => {
    if (required && reason.trim().length < 3) { setError("Give a short reason (3+ characters)"); return; }
    setBusy(true); setError("");
    try { await onConfirm(reason.trim()); onClose(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <label htmlFor="reason" className="mb-1.5 block text-sm font-semibold text-brand-800">Reason{required ? "" : " (optional)"}</label>
      <textarea id="reason" rows={3} placeholder="Add a short note for the audit trail (you can skip this)" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
        className="w-full resize-none rounded-xl border border-brand-200 bg-white p-3.5 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-300/40" />
      {error && <p key={error} className="animate-shake pt-2 text-sm font-medium text-bad" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={submit}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
