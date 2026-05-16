export function Spinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 text-sm text-slate-500"
    >
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
      />
      {label ?? "Loading…"}
    </div>
  );
}
