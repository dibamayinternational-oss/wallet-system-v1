/**
 * FILE: src/components/ui/RollingNumber.tsx
 * PURPOSE
 *   Two number animations:
 *   <RollingNumber> odometer style: every digit is a vertical reel that SPRINGS to its new
 *                   value, so when the balance changes you see the digits physically roll.
 *   <CountUp>       smooth ease from the old value to the new one (used for dashboard stats).
 * WHERE USED: WalletCard (balance), admin stats.
 * TAKES: a money string ("1250.50").  GIVES: animated text. Digits keep fixed width (tabular).
 */
import { animate, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "../../lib/format";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Reel({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1.1em] w-[0.62em] overflow-hidden align-bottom">
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={{ y: "0%" }} animate={{ y: `${-digit * 10}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 15, mass: 0.9 }}
      >
        {DIGITS.map((n) => <span key={n} className="block h-[1.1em] text-center leading-[1.1]">{n}</span>)}
      </motion.span>
    </span>
  );
}

export function RollingNumber({ value, className }: { value: string; className?: string }) {
  const text = formatMoney(value);
  const chars = [...text];
  return (
    <span className={className} aria-label={text}>
      {chars.map((ch, i) => {
        const fromEnd = chars.length - i; // stable keys from the right so reels keep their identity
        return /\d/.test(ch)
          ? <Reel key={`d${fromEnd}`} digit={Number(ch)} />
          : <span key={`c${fromEnd}`} className="inline-block align-bottom leading-[1.1]">{ch}</span>;
      })}
    </span>
  );
}

export function CountUp({ value, format = (n: number) => n.toLocaleString("en-US"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const controls = animate(from.current, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: setShown });
    from.current = value;
    return () => controls.stop();
  }, [value]);
  return <span className={className}>{format(shown)}</span>;
}
