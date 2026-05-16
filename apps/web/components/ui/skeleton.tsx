import { cn } from "@/lib/utils";

/**
 * Shimmer placeholder used while the real content is loading. Compose
 * several Skeletons in the same shape as the destination layout —
 * a Card-shaped Skeleton for a Card, a row of pill Skeletons for tabs,
 * etc. — so the layout doesn't jump when content arrives.
 */
export function Skeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-background/60 before:to-transparent before:animate-shimmer",
        className,
      )}
      {...rest}
    />
  );
}
