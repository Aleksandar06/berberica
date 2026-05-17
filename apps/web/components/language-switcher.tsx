"use client";

import { Check, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_META } from "@/lib/i18n/dictionary";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

/**
 * Globe-icon dropdown that flips the app between English and Macedonian.
 * Drops into any header (dashboard top bar, tenant storefront header)
 * without extra plumbing — reads + writes the cookie via the language
 * provider.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useT();
  const meta = LOCALE_META[locale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Change language"
          className={cn("gap-1.5", className)}
        >
          <Globe className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{meta.flag}</span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {locale}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LOCALES.map((l) => {
          const m = LOCALE_META[l];
          const active = l === locale;
          return (
            <DropdownMenuItem
              key={l}
              onSelect={() => setLocale(l)}
              className="gap-2 cursor-pointer"
            >
              <span aria-hidden className="text-base">
                {m.flag}
              </span>
              <span className="flex-1">{m.native}</span>
              {active && (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
