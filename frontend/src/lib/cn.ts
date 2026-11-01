/**
 * FILE: src/lib/cn.ts
 * PURPOSE: `cn(...)` joins CSS class names and resolves Tailwind conflicts
 *          (cn("p-2", cond && "p-4") => "p-4"). Used by every component.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
