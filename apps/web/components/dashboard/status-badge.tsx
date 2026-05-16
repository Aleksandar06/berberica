import { cn } from "@/components/ui/cn";

export function StatusBadge({
  status,
  variant,
}: {
  status: string;
  variant?: "success" | "warning" | "danger" | "neutral";
}) {
  const map: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    neutral: "bg-slate-100 text-slate-700",
  };
  const auto =
    !variant && status === "active"
      ? "success"
      : !variant && (status === "suspended" || status === "cancelled")
        ? "danger"
        : !variant && (status === "pending" || status === "no_show")
          ? "warning"
          : !variant && status === "confirmed"
            ? "success"
            : "neutral";
  const v = variant ?? auto;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        map[v],
      )}
    >
      {status}
    </span>
  );
}
