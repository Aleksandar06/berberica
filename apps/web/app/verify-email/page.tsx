"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  MailWarning,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";
import { resendVerification, verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n/language-context";

/**
 * Landing page for the link in the Resend account-verification email
 * (`apps/api/src/modules/notifications/notification-dispatcher.service.ts`
 * sends links to `${webBaseUrl}/verify-email?token=...`).
 *
 * The verify endpoint is anti-enumeration — it always returns 200 with
 * `{ ok: true }` regardless of token validity. So a network/HTTP error
 * is the only true failure signal here; an HTTP 200 is treated as
 * "verified or already-verified, move on."
 *
 * The resend form lets a user kick a new link if their original expired
 * (the original is single-use + 24-hour TTL). We collect the email here
 * because the token is opaque (a hashed random — can't be decoded).
 */
export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<VerifyingState />}>
        <VerifyEmailInner />
      </Suspense>
    </AuthLayout>
  );
}

function VerifyEmailInner() {
  const { t: dict } = useT();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: (tok: string) => verifyEmail(tok),
    onSuccess: () => setVerified(true),
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : dict.auth.verifyErrorDefault;
      setError(msg);
    },
  });

  // Fire-once on mount — the link is single-use, so verifying eagerly is
  // safe and matches the user's intent (they clicked a button labelled
  // "verify"; we shouldn't make them click another).
  useEffect(() => {
    if (!token) {
      setError(dict.auth.verifyErrorDefault);
      return;
    }
    verifyMutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token || error) return <ErrorState message={error} />;
  if (verified) return <SuccessState />;
  return <VerifyingState />;
}

// ---------------------------------------------------------------------------
// STATES
// ---------------------------------------------------------------------------

function VerifyingState() {
  const { t } = useT();
  return (
    <Card>
      <div className="flex flex-col items-center text-center gap-4">
        <div className="grid place-items-center h-14 w-14 rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="text-h2 text-foreground">{t.auth.verifyingTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t.auth.verifyingSubtitle}
          </p>
        </div>
      </div>
    </Card>
  );
}

function SuccessState() {
  const { t } = useT();
  return (
    <Card>
      <div className="flex flex-col items-center text-center gap-4 scale-in">
        <div className="grid place-items-center h-14 w-14 rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="text-h1 text-foreground">{t.auth.verifiedTitle}</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {t.auth.verifiedSubtitle}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full pt-2">
          <Button asChild className="w-full">
            <Link href="/dashboard">{t.auth.verifyContinue}</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">{t.auth.verifyBackHome}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ErrorState({ message }: { message: string | null }) {
  const { t } = useT();
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const resend = useMutation({
    mutationFn: (email: string) => resendVerification(email),
    onSuccess: () => setResendSent(true),
  });

  return (
    <Card>
      <div className="flex flex-col items-center text-center gap-4">
        <div className="grid place-items-center h-14 w-14 rounded-full bg-warning/15 text-[hsl(30_60%_28%)]">
          <MailWarning className="h-7 w-7" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="text-h1 text-foreground">{t.auth.verifyErrorTitle}</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {message ?? t.auth.verifyErrorDefault}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <p className="text-sm text-foreground">{t.auth.verifyResendIntro}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (resendEmail) resend.mutate(resendEmail);
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label htmlFor="resend-email">{t.auth.email}</Label>
            <Input
              id="resend-email"
              type="email"
              autoComplete="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={resend.isPending || resendSent}
          >
            {resendSent
              ? t.auth.verifyResendSent
              : resend.isPending
                ? t.auth.verifyResendSending
                : t.auth.verifyResendButton}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {t.auth.verifyAlreadyVerified}{" "}
            <Link
              href="/dashboard/login"
              className="text-primary hover:underline"
            >
              {t.auth.signInCta}
            </Link>
          </p>
        </form>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm fade-in">
      {children}
    </div>
  );
}
