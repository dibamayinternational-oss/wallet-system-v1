/**
 * FILE: src/lib/idempotency.ts
 * PURPOSE
 *   Creates the unique `Idempotency-Key` sent with every money request.
 *   The server remembers the key: if the same request arrives twice (double click,
 *   network retry) the money moves ONCE and the second call just returns the first result.
 * WHERE USED: Deposit / Withdraw / Transfer pages (via useIdempotencyKey).
 */
import { useCallback, useRef } from "react";

export function newKey(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // crypto.randomUUID needs HTTPS or localhost; this fallback works everywhere.
  const bytes = c.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One key per "intent". Keep calling `current()` for retries of the SAME attempt;
 * call `renew()` after a success (or when the user changes the form) to start a new intent.
 */
export function useIdempotencyKey() {
  const ref = useRef(newKey());
  const current = useCallback(() => ref.current, []);
  const renew = useCallback(() => { ref.current = newKey(); }, []);
  return { current, renew };
}
