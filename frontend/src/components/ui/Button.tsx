/**
 * FILE: src/components/ui/Button.tsx
 * PURPOSE: The app's button. Variants: primary / secondary / ghost / danger.
 *          Feels alive: lifts on hover, presses on click, a light sweep crosses the
 *          primary button, and `loading` swaps the label for a spinner (and blocks clicks,
 *          which also helps prevent accidental double submits).
 * WHERE USED: everywhere.
 */
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  size?: "md" | "lg" | "sm";
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-800 text-brand-50 shadow-soft hover:bg-brand-900 hover:shadow-lift",
  secondary: "bg-white text-brand-900 ring-1 ring-brand-200 hover:ring-brand-400 hover:bg-brand-50",
  ghost: "text-brand-800 hover:bg-brand-100",
  danger: "bg-bad text-white hover:brightness-110 shadow-soft",
};
const SIZES = { sm: "h-9 px-3 text-sm gap-1.5", md: "h-11 px-5 text-[15px] gap-2", lg: "h-14 px-7 text-base gap-2.5" };

export function Button({ variant = "primary", size = "md", loading, icon, children, className, disabled, ...rest }: Props) {
  return (
    <motion.button
      whileHover={disabled || loading ? undefined : { y: -1.5 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      disabled={disabled || loading}
      className={cn(
        "group relative inline-flex select-none items-center justify-center overflow-hidden rounded-xl font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {variant === "primary" && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/15 opacity-0 transition-all duration-700 group-hover:left-[130%] group-hover:opacity-100" />
      )}
      {loading ? <Loader2 className="size-5 animate-spin" /> : icon}
      <span className="relative">{children}</span>
    </motion.button>
  );
}
