import { cookies } from "next/headers";

import { type Dictionary, type Locale } from "./dictionary";
import { parseLocaleCookie } from "./parse-cookie";
import { en } from "./messages.en";
import { mk } from "./messages.mk";

const MESSAGES: Record<Locale, Dictionary> = { en, mk };

/**
 * Server-side counterpart to the client `useT()` hook. Reads the `lang`
 * cookie from the request and returns the matching dictionary so server
 * components (storefront, services list, etc.) can render localized HTML
 * on first paint without hydration flash.
 *
 *   const { t, locale } = await getServerT();
 *   return <h1>{t.storefront.servicesHeading}</h1>;
 */
export async function getServerT(): Promise<{
  locale: Locale;
  t: Dictionary;
}> {
  const cookieStore = await cookies();
  const locale = parseLocaleCookie(cookieStore.get("lang")?.value);
  return { locale, t: MESSAGES[locale] };
}
