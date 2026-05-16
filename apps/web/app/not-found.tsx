import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GlobalNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center text-primary">
          <Compass className="h-8 w-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            404
          </p>
          <h1 className="text-h1 text-foreground">Page not found</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find what you were looking for.
          </p>
        </div>
        <Button asChild leadingIcon={<ArrowLeft />}>
          <Link href="/">Back to the platform home</Link>
        </Button>
      </div>
    </main>
  );
}
