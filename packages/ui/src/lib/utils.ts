import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts (used by all UI components). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
