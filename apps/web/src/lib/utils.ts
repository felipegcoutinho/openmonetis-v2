import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Custom theme shadows must be registered so `shadow-none` can override them when merging.
const twMerge = extendTailwindMerge({
  extend: { theme: { shadow: ["menu"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
