"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StickySaveBarProps {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saving?: boolean;
  message?: string;
  /** Optional extra class names on the outer fixed wrapper. */
  className?: string;
}

/**
 * Sticky "unsaved changes" bar — appears at the bottom of the viewport
 * when a form is dirty. Standard pattern used by Linear, Vercel, Cal.com.
 *
 * On mobile, sits above the bottom tab bar so it doesn't get covered
 * (offset via `bottom-20`). On desktop, sits flush with the viewport
 * bottom. Respects iOS safe-area for the home indicator.
 *
 * Visibility uses opacity + translate so the bar slides in rather than
 * popping — feels more like a peer notification than a layout shift.
 */
export function StickySaveBar({
  visible,
  onSave,
  onDiscard,
  saving = false,
  message = "You have unsaved changes",
  className,
}: StickySaveBarProps) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Unsaved changes"
      className={cn(
        "fixed inset-x-3 sm:inset-x-6 z-40 transition-all duration-300",
        // Sit above the mobile bottom nav (h-16 + safe-area).
        "bottom-20 lg:bottom-6",
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-4 opacity-0 pointer-events-none",
        className,
      )}
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-foreground text-background shadow-xl px-4 py-3 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/10 shrink-0">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-warning" />
          )}
        </span>
        <p className="text-sm font-medium flex-1 truncate">{message}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="text-sm font-medium text-background/80 hover:text-background transition disabled:opacity-50"
          >
            Discard
          </button>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="bg-background text-foreground hover:bg-background/90"
            onClick={onSave}
            loading={saving}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
