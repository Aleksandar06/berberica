"use client";

import { cn } from "@/lib/utils";

/**
 * Lightweight password strength meter. Heuristic only — for an MVP it's
 * better than nothing and avoids pulling in zxcvbn (~400KB). Scores 0-4
 * based on length and the variety of character classes used.
 */
function score(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const bounded = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  const labels: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "Too short",
    1: "Weak",
    2: "Okay",
    3: "Strong",
    4: "Very strong",
  };
  return { score: bounded, label: labels[bounded] };
}

const TONE: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-border",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
};

export function PasswordStrength({ value }: { value: string }) {
  const { score: s, label } = score(value);
  return (
    <div aria-live="polite" className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              s >= bar ? TONE[s] : "bg-border",
            )}
          />
        ))}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          Password strength: <span className="font-medium text-foreground">{label}</span>
        </p>
      )}
    </div>
  );
}
