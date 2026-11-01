/**
 * FILE: src/lib/format.ts
 * PURPOSE: Display helpers for money and dates (display only - never used for business rules).
 * WHERE USED: every page/component that shows an amount or a time.
 */
let currency = "BDT";
export const setCurrency = (c: string) => { currency = c; };
export const getCurrency = () => currency;

const SYMBOLS: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€", GBP: "£", INR: "₹" };

/** "12500.5" -> "12,500.50" */
export function formatAmount(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

/** "12500.5" -> "৳12,500.50" */
export function formatMoney(value: string | number): string {
  return `${SYMBOLS[currency] ?? currency + " "}${formatAmount(value)}`;
}

export const currencySymbol = () => SYMBOLS[currency] ?? currency;

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;

export const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", TRANSFER: "Transfer", FEE: "Fee", REVERSAL: "Reversal",
};

/** "3 min ago", "2 h ago", "5 d ago" (falls back to a date after a week). */
export function timeAgo(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  if (sec < 7 * 86400) return `${Math.round(sec / 86400)} d ago`;
  return formatDate(iso);
}
