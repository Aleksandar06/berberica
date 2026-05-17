import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { parseLocaleCookie } from "@/lib/i18n/parse-cookie";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Berberica — Book beauty, wellness & barbershop appointments",
  description:
    "Multi-tenant scheduling platform for hair, beauty, and wellness businesses.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Read the `lang` cookie on the server so the initial HTML carries the
  // correct lang attribute + the LanguageProvider hydrates with the user's
  // chosen locale — no flash from English → Macedonian on first paint.
  const cookieStore = await cookies();
  const locale = parseLocaleCookie(cookieStore.get("lang")?.value);
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
