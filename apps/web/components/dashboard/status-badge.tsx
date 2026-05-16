import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  active: { label: "Active", variant: "success" },
  suspended: { label: "Suspended", variant: "destructive" },
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  completed: { label: "Completed", variant: "neutral" },
  no_show: { label: "No show", variant: "warning" },
};

/**
 * Maps an API status string to a styled Badge. Kept as a separate
 * component so any future status colour rules live in one place and
 * call sites stay terse: `<StatusBadge status={booking.status} />`.
 */
export function StatusBadge({
  status,
  variant,
}: {
  status: string;
  variant?: BadgeProps["variant"];
}) {
  const mapped = STATUS_MAP[status];
  return <Badge variant={variant ?? mapped?.variant ?? "neutral"}>{mapped?.label ?? status}</Badge>;
}
