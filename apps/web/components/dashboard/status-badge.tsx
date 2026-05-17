"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/language-context";
import type { Dictionary } from "@/lib/i18n/dictionary";

const VARIANT_MAP: Record<string, BadgeProps["variant"]> = {
  active: "success",
  suspended: "destructive",
  inactive: "neutral",
  pending: "warning",
  confirmed: "success",
  cancelled: "destructive",
  completed: "neutral",
  no_show: "warning",
};

/**
 * Maps an API status string to a styled, localized Badge. Status keys mirror
 * the API enum exactly so adding a new value only needs a translation entry
 * + a variant mapping below.
 */
export function StatusBadge({
  status,
  variant,
}: {
  status: string;
  variant?: BadgeProps["variant"];
}) {
  const { t } = useT();
  const label =
    (t.status as Record<string, string | undefined>)[status] ?? status;
  return (
    <Badge variant={variant ?? VARIANT_MAP[status] ?? "neutral"}>{label}</Badge>
  );
}

// Helps TS show the keys we expect when consumers want to ensure they
// pass a known status — but at runtime we accept anything.
export type KnownStatus = keyof Dictionary["status"];
