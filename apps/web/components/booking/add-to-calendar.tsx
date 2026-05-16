"use client";

import { Calendar, Download } from "lucide-react";
import { DateTime } from "luxon";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";

export interface AddToCalendarProps {
  title: string;
  /** UTC ISO of the appointment start. */
  startUtc: string;
  /** UTC ISO of the appointment end. */
  endUtc: string;
  description?: string;
  location?: string;
  /** Stable identifier for the appointment — used as the .ics UID. */
  uid: string;
}

/**
 * Generates an .ics file + a Google Calendar URL for the appointment.
 * Outlook web calendar takes the same URL params as Google so we surface
 * one URL-style action and the .ics download covers Apple / Outlook
 * desktop / everything else.
 */
export function AddToCalendarButtons(props: AddToCalendarProps) {
  const { icsUrl, googleUrl } = useMemo(() => {
    const start = DateTime.fromISO(props.startUtc, { zone: "utc" });
    const end = DateTime.fromISO(props.endUtc, { zone: "utc" });
    return {
      icsUrl: buildIcsDataUrl({
        title: props.title,
        start,
        end,
        description: props.description,
        location: props.location,
        uid: props.uid,
      }),
      googleUrl: buildGoogleUrl({
        title: props.title,
        start,
        end,
        description: props.description,
        location: props.location,
      }),
    };
  }, [props]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 justify-center">
      <Button asChild variant="secondary" size="md" leadingIcon={<Calendar />}>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
          Google Calendar
        </a>
      </Button>
      <Button asChild variant="secondary" size="md" leadingIcon={<Download />}>
        <a href={icsUrl} download={`${slugify(props.title)}.ics`}>
          Download .ics
        </a>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "appointment";
}

function formatIcs(dt: DateTime): string {
  // YYYYMMDDTHHMMSSZ (UTC, basic format)
  return dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function buildIcsDataUrl(args: {
  title: string;
  start: DateTime;
  end: DateTime;
  description?: string;
  location?: string;
  uid: string;
}): string {
  // Escape per RFC 5545: backslash → \\, comma → \,, semicolon → \;, newline → \n
  const esc = (s: string | undefined): string =>
    (s ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Berberica//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${esc(args.uid)}@berberica`,
    `DTSTAMP:${formatIcs(DateTime.utc())}`,
    `DTSTART:${formatIcs(args.start)}`,
    `DTEND:${formatIcs(args.end)}`,
    `SUMMARY:${esc(args.title)}`,
    args.description ? `DESCRIPTION:${esc(args.description)}` : "",
    args.location ? `LOCATION:${esc(args.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const ics = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function buildGoogleUrl(args: {
  title: string;
  start: DateTime;
  end: DateTime;
  description?: string;
  location?: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: args.title,
    dates: `${formatIcs(args.start)}/${formatIcs(args.end)}`,
  });
  if (args.description) params.set("details", args.description);
  if (args.location) params.set("location", args.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
