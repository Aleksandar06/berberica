"use client";

import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { ArrowDownRight, PiggyBank, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { businessApi, type EarningsResponse } from "@/lib/api/business";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatMoney } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

type Preset = "today" | "week" | "month" | "custom";

/**
 * Earnings page — answers "how is my business actually doing?" in one
 * scan. Three KPIs at the top (earned / projected / lost), a daily bar
 * chart of revenue across the selected window, and breakdown tables by
 * service + by staff.
 *
 * The window is a quick-preset segmented control with a custom date
 * range as the escape hatch. Numbers are pulled from the business
 * analytics endpoint, which buckets bookings by status and aggregates
 * the matching service's priceCents — no client-side math beyond
 * formatting.
 */
export default function BusinessEarningsPage() {
  const { t } = useT();
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(
    () => resolveWindow(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const earnings = useQuery({
    queryKey: ["business-earnings", from, to],
    queryFn: () => businessApi.analytics.earnings({ from, to }),
  });

  const description = useMemo(() => {
    if (!earnings.data) return t.earnings.descriptionEmpty;
    const earned = earnings.data.totals.earned.cents;
    const projected = earnings.data.totals.projected.cents;
    if (earned === 0 && projected === 0) {
      return t.earnings.descriptionDefault;
    }
    return (
      <span className="tabular-nums">
        <strong className="text-foreground font-semibold">
          {formatMoney(earned, earnings.data.currency)}
        </strong>{" "}
        {t.earnings.kpiEarned.toLowerCase()}
        <span className="text-border mx-2">·</span>
        <strong className="text-foreground font-semibold">
          {formatMoney(projected, earnings.data.currency)}
        </strong>{" "}
        {t.earnings.kpiProjected.toLowerCase()}
      </span>
    );
  }, [earnings.data, t]);

  return (
    <>
      <PageHeader
        title={t.earnings.title}
        description={description}
        actions={
          <Tabs
            value={preset}
            onValueChange={(v) => setPreset(v as Preset)}
          >
            <TabsList className="h-10">
              <TabsTrigger value="today">{t.earnings.presetToday}</TabsTrigger>
              <TabsTrigger value="week">{t.earnings.preset7Days}</TabsTrigger>
              <TabsTrigger value="month">{t.earnings.preset30Days}</TabsTrigger>
              <TabsTrigger value="custom">{t.earnings.presetCustom}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {preset === "custom" && (
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label
                htmlFor="from"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                {t.earnings.from}
              </Label>
              <Input
                id="from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="to"
                className="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                {t.earnings.to}
              </Label>
              <Input
                id="to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {earnings.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      )}

      {earnings.data && <EarningsContent data={earnings.data} />}
    </>
  );
}

// ===========================================================================
// PIECES
// ===========================================================================

function EarningsContent({ data }: { data: EarningsResponse }) {
  const { t } = useT();
  const totalBookings =
    data.totals.earned.count +
    data.totals.projected.count +
    data.totals.lost.count;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label={t.earnings.kpiEarned}
          value={formatMoney(data.totals.earned.cents, data.currency)}
          sub={t.earnings.kpiEarnedSub(data.totals.earned.count)}
          tone="success"
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <KpiCard
          label={t.earnings.kpiProjected}
          value={formatMoney(data.totals.projected.cents, data.currency)}
          sub={t.earnings.kpiProjectedSub(data.totals.projected.count)}
          tone="primary"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          label={t.earnings.kpiLost}
          value={formatMoney(data.totals.lost.cents, data.currency)}
          sub={t.earnings.kpiLostSub(data.totals.lost.count)}
          tone="destructive"
          icon={<ArrowDownRight className="h-4 w-4" />}
        />
      </div>

      {totalBookings === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={t.earnings.emptyTitle}
          description={t.earnings.emptyBody}
        />
      ) : (
        <>
          <EarningsChart data={data} />

          <div className="grid lg:grid-cols-2 gap-3">
            <BreakdownTable
              title={t.earnings.topServices}
              rows={data.byService.map((s) => ({
                id: s.id,
                label: s.name,
                count: s.count,
                cents: s.cents,
              }))}
              currency={data.currency}
              emptyLabel={t.earnings.noRevenueServices}
            />
            <BreakdownTable
              title={t.earnings.topStaff}
              rows={data.byStaff.map((s) => ({
                id: s.id,
                label: s.displayName,
                count: s.count,
                cents: s.cents,
              }))}
              currency={data.currency}
              emptyLabel={t.earnings.noRevenueStaff}
            />
          </div>
        </>
      )}
    </>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "success" | "destructive";
  icon: React.ReactNode;
}) {
  const toneClass: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <article className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          {label}
        </p>
        <span
          aria-hidden
          className={cn(
            "grid place-items-center h-8 w-8 rounded-full",
            toneClass[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <p className="text-h1 text-foreground tabular-nums leading-tight">
        {value}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{sub}</p>
    </article>
  );
}

/**
 * Inline SVG bar chart of daily earnings. Pure SVG — no chart library
 * dependency. Two stacked bars per day: earned (solid brand) + projected
 * (lighter brand). Hover reveals a numeric tooltip. Accessible: each bar
 * carries a <title> element for screen readers.
 */
function EarningsChart({ data }: { data: EarningsResponse }) {
  const { t } = useT();
  const max = Math.max(
    ...data.byDay.map((d) => d.earnedCents + d.projectedCents),
    1,
  );
  const days = data.byDay;
  // Compact axis labels — only first / last / middle if 7+ days.
  const showLabel = (idx: number, len: number) => {
    if (len <= 7) return true;
    if (idx === 0 || idx === len - 1) return true;
    return idx === Math.floor(len / 2);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          {t.earnings.chartTitle}
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm bg-success"
            />
            {t.earnings.legendEarned}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm bg-primary/50"
            />
            {t.earnings.legendProjected}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-48">
        {days.map((d, idx) => {
          const earnedH = (d.earnedCents / max) * 100;
          const projectedH = (d.projectedCents / max) * 100;
          const total = d.earnedCents + d.projectedCents;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center justify-end gap-1 group"
              title={`${d.date} — earned ${formatMoney(d.earnedCents, data.currency)} · projected ${formatMoney(d.projectedCents, data.currency)}`}
            >
              <div className="w-full flex flex-col-reverse rounded-md overflow-hidden bg-muted/40">
                <div
                  className="bg-success transition-all group-hover:brightness-110"
                  style={{ height: `${earnedH}%` }}
                  aria-hidden
                />
                <div
                  className="bg-primary/50 transition-all group-hover:brightness-110"
                  style={{ height: `${projectedH}%` }}
                  aria-hidden
                />
              </div>
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  total > 0 ? "text-muted-foreground" : "text-muted-foreground/50",
                  !showLabel(idx, days.length) && "sm:invisible",
                )}
              >
                {DateTime.fromISO(d.date).toFormat("MMM d")}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BreakdownTable({
  title,
  rows,
  currency,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ id: string; label: string; count: number; cents: number }>;
  currency: string;
  emptyLabel: string;
}) {
  const { t } = useT();
  const total = rows.reduce((sum, r) => sum + r.cents, 0);
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-border">
        <h2 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          {title}
        </h2>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center">
          {emptyLabel}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const share = total === 0 ? 0 : (r.cents / total) * 100;
            return (
              <li key={r.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground truncate">
                    {r.label}
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMoney(r.cents, currency)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary/70"
                      style={{ width: `${share}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {r.count} {t.common.bookings(r.count)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ===========================================================================
// HELPERS
// ===========================================================================

function resolveWindow(
  preset: Preset,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const today = DateTime.now().toISODate() ?? "";
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week":
      return {
        from: DateTime.now().minus({ days: 6 }).toISODate() ?? today,
        to: today,
      };
    case "month":
      return {
        from: DateTime.now().minus({ days: 29 }).toISODate() ?? today,
        to: today,
      };
    case "custom":
      return {
        from: customFrom || today,
        to: customTo || today,
      };
  }
}

