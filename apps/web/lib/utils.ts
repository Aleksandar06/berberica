import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Shadcn-convention class helper. Merges Tailwind classes with proper
 * precedence (later classes win), so `cn("p-2", isActive && "p-4")`
 * resolves to the right padding.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
