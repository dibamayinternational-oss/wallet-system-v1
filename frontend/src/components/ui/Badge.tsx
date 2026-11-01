/**
 * FILE: src/components/ui/Badge.tsx
 * PURPOSE: Small coloured pills for statuses (ACTIVE/FROZEN, PENDING/COMPLETED/REJECTED)
 *          and transaction types, so state is readable at a glance.
 * WHERE USED: tables, cards, wallet card.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "ok" | "warn" | "bad" | "neutral" | "dark";
const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad",
  neutral: "bg-brand-100 text-brand-800", dark: "bg-brand-800 text-brand-50",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const statusTone = (s: string): Tone =>
  ({ ACTIVE: "ok", COMPLETED: "ok", PENDING: "warn", FROZEN: "bad", REJECTED: "bad" } as Record<string, Tone>)[s] ?? "neutral";
