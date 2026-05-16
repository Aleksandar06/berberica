import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Renders when the tenant layout's profile fetch returns 404 (unknown slug,
 * reserved slug, or malformed). Generic copy — never reveals whether the
 * slug exists for system reasons.
 */
export default function TenantNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center text-primary">
          <Building2 className="h-8 w-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            404
          </p>
          <h1 className="text-h1 text-foreground">
            We couldn&apos;t find that business
          </h1>
          <p className="text-muted-foreground">
            Double-check the address — every business on this platform lives at
            its own URL.
          </p>
        </div>
        <Button asChild leadingIcon={<ArrowLeft />}>
          <Link href="/">Back to the platform home</Link>
        </Button>
      </div>
    </main>
  );
}
