"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { businessApi } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/confirm-dialog";
import { errorMessage, useToast } from "@/lib/ui/toast";

const DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

function timeOnly(iso: string): string {
  // Server returns dates as ISO with 1970-01-01 prefix for TIME columns.
  return iso.substring(11, 16);
}

function dateOnly(iso: string): string {
  return iso.substring(0, 10);
}

export default function AvailabilityPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const aggregate = useQuery({
    queryKey: ["business-availability"],
    queryFn: () => businessApi.availability.aggregate(),
  });
  const staff = useQuery({
    queryKey: ["business-staff"],
    queryFn: () => businessApi.staff.list(),
  });

  const inv = () =>
    void qc.invalidateQueries({ queryKey: ["business-availability"] });

  const addRule = useMutation({
    mutationFn: businessApi.availability.createRule,
    onSuccess: () => {
      toast.success("Rule added.");
      inv();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delRule = useMutation({
    mutationFn: (id: string) => businessApi.availability.deleteRule(id),
    onSuccess: () => {
      toast.success("Rule deleted.");
      inv();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addBreak = useMutation({
    mutationFn: businessApi.availability.createBreak,
    onSuccess: () => {
      toast.success("Break added.");
      inv();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delBreak = useMutation({
    mutationFn: (id: string) => businessApi.availability.deleteBreak(id),
    onSuccess: () => {
      toast.success("Break deleted.");
      inv();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addException = useMutation({
    mutationFn: businessApi.availability.createException,
    onSuccess: () => {
      toast.success("Exception added.");
      inv();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delException = useMutation({
    mutationFn: (id: string) => businessApi.availability.deleteException(id),
    onSuccess: () => {
      toast.success("Exception deleted.");
      inv();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (aggregate.isLoading || staff.isLoading) return <Spinner />;
  if (!aggregate.data || !staff.data) return null;

  return (
    <>
      <PageHeading
        title="Availability"
        description="Weekly hours, recurring breaks, and date-specific exceptions. Staff-specific entries override tenant-wide for hours, and combine for breaks."
      />

      <Section title="Weekly working hours">
        <RuleForm
          staff={staff.data}
          onSubmit={(payload) => addRule.mutate(payload)}
          submitting={addRule.isPending}
        />
        <ItemTable
          empty="No weekly rules yet."
          confirmTitle="Delete this working-hours rule?"
          rows={aggregate.data.rules.map((r) => ({
            id: r.id,
            cols: [
              DAYS[r.dayOfWeek] ?? "?",
              `${timeOnly(r.startTime)}–${timeOnly(r.endTime)}`,
              r.staffMemberId
                ? staff.data!.find((s) => s.id === r.staffMemberId)
                    ?.displayName ?? "?"
                : "(tenant-wide)",
              r.slotDurationMinutes ? `${r.slotDurationMinutes}m slot` : "default slot",
            ],
            onDelete: () => delRule.mutate(r.id),
          }))}
        />
      </Section>

      <Section title="Weekly breaks">
        <BreakForm
          staff={staff.data}
          onSubmit={(payload) => addBreak.mutate(payload)}
          submitting={addBreak.isPending}
        />
        <ItemTable
          empty="No weekly breaks yet."
          confirmTitle="Delete this break?"
          rows={aggregate.data.breaks.map((b) => ({
            id: b.id,
            cols: [
              DAYS[b.dayOfWeek] ?? "?",
              `${timeOnly(b.startTime)}–${timeOnly(b.endTime)}`,
              b.staffMemberId
                ? staff.data!.find((s) => s.id === b.staffMemberId)
                    ?.displayName ?? "?"
                : "(tenant-wide)",
            ],
            onDelete: () => delBreak.mutate(b.id),
          }))}
        />
      </Section>

      <Section title="Date-specific exceptions">
        <ExceptionForm
          staff={staff.data}
          onSubmit={(payload) => addException.mutate(payload)}
          submitting={addException.isPending}
        />
        <ItemTable
          empty="No exceptions configured."
          confirmTitle="Delete this exception?"
          rows={aggregate.data.exceptions.map((e) => ({
            id: e.id,
            cols: [
              dateOnly(e.exceptionDate),
              e.isClosed
                ? "CLOSED"
                : e.customStartTime && e.customEndTime
                  ? `${timeOnly(e.customStartTime)}–${timeOnly(e.customEndTime)}`
                  : "—",
              e.staffMemberId
                ? staff.data!.find((s) => s.id === e.staffMemberId)
                    ?.displayName ?? "?"
                : "(tenant-wide)",
              e.reason ?? "",
            ],
            onDelete: () => delException.mutate(e.id),
          }))}
        />
      </Section>
    </>
  );
}

// ===========================================================================
// PRIMITIVES
// ===========================================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function ItemTable({
  rows,
  empty,
  confirmTitle,
}: {
  rows: Array<{ id: string; cols: string[]; onDelete: () => void }>;
  empty: string;
  confirmTitle: string;
}) {
  const confirm = useConfirm();
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              {r.cols.map((c, i) => (
                <td key={i} className="p-3 text-foreground">
                  {c}
                </td>
              ))}
              <td className="p-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    const ok = await confirm({
                      title: confirmTitle,
                      description: "This change applies immediately.",
                      confirmText: "Delete",
                      tone: "destructive",
                    });
                    if (ok) r.onDelete();
                  }}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleForm({
  staff,
  onSubmit,
  submitting,
}: {
  staff: { id: string; displayName: string }[];
  onSubmit: (payload: {
    staffMemberId?: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }) => void;
  submitting: boolean;
}) {
  const [dayOfWeek, setDow] = useState(1);
  const [startTime, setStart] = useState("09:00");
  const [endTime, setEnd] = useState("17:00");
  const [staffMemberId, setStaff] = useState<string>("");
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit({
          staffMemberId: staffMemberId || null,
          dayOfWeek,
          startTime,
          endTime,
          isActive: true,
        });
      }}
      className="rounded-lg border bg-white p-4 grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end"
    >
      <div>
        <Label htmlFor="dow-rule">Day</Label>
        <select
          id="dow-rule"
          value={dayOfWeek}
          onChange={(e) => setDow(Number(e.target.value))}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="rstart">Start</Label>
        <Input
          id="rstart"
          type="time"
          value={startTime}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="rend">End</Label>
        <Input
          id="rend"
          type="time"
          value={endTime}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="rstaff">Staff</Label>
        <select
          id="rstaff"
          value={staffMemberId}
          onChange={(e) => setStaff(e.target.value)}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Tenant-wide</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={submitting}>
        Add rule
      </Button>
    </form>
  );
}

function BreakForm({
  staff,
  onSubmit,
  submitting,
}: {
  staff: { id: string; displayName: string }[];
  onSubmit: (payload: {
    staffMemberId?: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }) => void;
  submitting: boolean;
}) {
  const [dayOfWeek, setDow] = useState(1);
  const [startTime, setStart] = useState("12:00");
  const [endTime, setEnd] = useState("13:00");
  const [staffMemberId, setStaff] = useState<string>("");
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit({
          staffMemberId: staffMemberId || null,
          dayOfWeek,
          startTime,
          endTime,
          isActive: true,
        });
      }}
      className="rounded-lg border bg-white p-4 grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end"
    >
      <div>
        <Label htmlFor="dow-br">Day</Label>
        <select
          id="dow-br"
          value={dayOfWeek}
          onChange={(e) => setDow(Number(e.target.value))}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="bstart">Start</Label>
        <Input
          id="bstart"
          type="time"
          value={startTime}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="bend">End</Label>
        <Input
          id="bend"
          type="time"
          value={endTime}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="bstaff">Staff</Label>
        <select
          id="bstaff"
          value={staffMemberId}
          onChange={(e) => setStaff(e.target.value)}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Tenant-wide</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={submitting}>
        Add break
      </Button>
    </form>
  );
}

function ExceptionForm({
  staff,
  onSubmit,
  submitting,
}: {
  staff: { id: string; displayName: string }[];
  onSubmit: (payload: {
    staffMemberId?: string | null;
    exceptionDate: string;
    isClosed: boolean;
    customStartTime?: string | null;
    customEndTime?: string | null;
    reason?: string | null;
  }) => void;
  submitting: boolean;
}) {
  const [date, setDate] = useState("");
  const [isClosed, setClosed] = useState(true);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [staffMemberId, setStaff] = useState<string>("");
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit({
          staffMemberId: staffMemberId || null,
          exceptionDate: date,
          isClosed,
          customStartTime: isClosed ? null : customStart || null,
          customEndTime: isClosed ? null : customEnd || null,
          reason: reason || null,
        });
      }}
      className="rounded-lg border bg-white p-4 space-y-3"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="exDate">Date</Label>
          <Input
            id="exDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="exStaff">Staff</Label>
          <select
            id="exStaff"
            value={staffMemberId}
            onChange={(e) => setStaff(e.target.value)}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tenant-wide</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isClosed}
              onChange={(e) => setClosed(e.target.checked)}
              className="h-4 w-4"
            />
            Closed all day
          </label>
        </div>
      </div>
      {!isClosed && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cStart">Custom start</Label>
            <Input
              id="cStart"
              type="time"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="cEnd">Custom end</Label>
            <Input
              id="cEnd"
              type="time"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              required
            />
          </div>
        </div>
      )}
      <div>
        <Label htmlFor="reason">Reason (optional)</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          Add exception
        </Button>
      </div>
    </form>
  );
}
