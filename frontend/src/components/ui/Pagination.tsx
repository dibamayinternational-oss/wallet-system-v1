/**
 * FILE: src/components/ui/Pagination.tsx
 * PURPOSE: Previous/next controls with "Page 2 of 7 · 96 results".
 * WHERE USED: History, admin accounts, admin transactions.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <p className="text-sm text-brand-700">Page {page} of {pages} · {total} results</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<ChevronLeft className="size-4" />}>Prev</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}><span className="flex items-center gap-1">Next <ChevronRight className="size-4" /></span></Button>
      </div>
    </div>
  );
}
