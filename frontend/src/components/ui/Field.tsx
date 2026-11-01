/**
 * FILE: src/components/ui/Field.tsx
 * PURPOSE
 *   Form inputs:
 *     <Field>       label + input + animated error message (input shakes when invalid)
 *     <MoneyField>  amount input: currency symbol, numbers only, max 2 decimals while typing
 * WHERE USED: all forms (React Hook Form passes `register(...)` / a controller).
 */
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { currencySymbol } from "../../lib/format";

interface FieldProps extends ComponentProps<"input"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, leading, trailing, className, id, ...rest }, ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  // Password fields get an eye button to show/hide what you typed.
  const [visible, setVisible] = useState(false);
  const isPassword = rest.type === "password";
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-brand-800">{label}</label>
      <div
        key={error ? "err" : "ok"}
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-white px-3.5 transition-all duration-200",
          "focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-300/40",
          error ? "animate-shake border-bad ring-4 ring-bad/10" : "border-brand-200 hover:border-brand-400",
        )}
      >
        {leading && <span className="text-brand-600">{leading}</span>}
        <input
          id={inputId} ref={ref} aria-invalid={!!error}
          className="h-12 w-full min-w-0 bg-transparent text-[15px] text-brand-900 outline-none placeholder:text-brand-400"
          {...rest}
          type={isPassword && visible ? "text" : rest.type}
        />
        {isPassword ? (
          <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}
            className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-brand-600 transition hover:bg-brand-100 hover:text-brand-900">
            {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        ) : trailing}
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p key="e" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pt-1.5 text-sm font-medium text-bad" role="alert">{error}</motion.p>
        ) : hint ? (
          <p key="h" className="pt-1.5 text-sm text-brand-600">{hint}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

interface MoneyFieldProps { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; autoFocus?: boolean }

/** Keeps only digits + one dot, max 2 decimals: "12.345" -> "12.34", "abc" -> "". */
export function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole.slice(0, 12);
  return `${whole.slice(0, 12)}.${rest.join("").slice(0, 2)}`;
}

export function MoneyField({ label, value, onChange, error, hint, autoFocus }: MoneyFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-brand-800">{label}</label>
      <div
        key={error ? "err" : "ok"}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-2xl border bg-white px-4 transition-all duration-200 sm:gap-3 sm:px-5",
          "focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-300/40",
          error ? "animate-shake border-bad ring-4 ring-bad/10" : "border-brand-200 hover:border-brand-400",
        )}
      >
        <span className="font-display text-2xl font-semibold text-brand-500 sm:text-3xl">{currencySymbol()}</span>
        <input
          id={id} inputMode="decimal" autoComplete="off" autoFocus={autoFocus} placeholder="0.00" value={value}
          onChange={(e) => onChange(sanitizeAmount(e.target.value))} aria-invalid={!!error}
          className="tnum h-16 w-full min-w-0 bg-transparent font-display text-3xl sm:h-20 sm:text-4xl font-semibold text-brand-900 outline-none placeholder:text-brand-300"
        />
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p key="e" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pt-1.5 text-sm font-medium text-bad" role="alert">{error}</motion.p>
        ) : hint ? <p key="h" className="pt-1.5 text-sm text-brand-600">{hint}</p> : null}
      </AnimatePresence>
    </div>
  );
}
