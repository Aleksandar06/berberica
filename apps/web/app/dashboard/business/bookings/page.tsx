"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useState } from "react";

import { businessApi } from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

export default function BusinessBookingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    staffMemberId: "",
    status: "",
  });
  const staff = useQuery({
    queryKey: ["business-staff"],
    queryFn: () => businessApi.staff.list(),
  });
  const bookings = useQuery({
    queryKey: ["business-bookings-list", filters],
    queryFn: () =>
      businessApi.bookings.list({
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        staffMemberId: filters.staffMemberId || undefined,
        status: filters.status || undefined,
        pageSize: 100,
      }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      businessApi.bookings.cancel(id, "Cancelled by admin"),
    onSuccess: () => {
      toast.success("Booking cancelled.");
      void qc.invalidateQueries({ queryKey: ["business-bookings-list"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reschedule = useMutation({
    mutationFn: ({ id, newStartAt }: { id: string; newStartAt: string }) =>
      businessApi.bookings.reschedule(id, newStartAt),
    onSuccess: () => {
      toast.success("Booking rescheduled.");
      void qc.invalidateQueries({ queryKey: ["business-bookings-list"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "SLOT_UNAVAILABLE") {
        toast.error("That slot is no longer available.");
      } else if (e instanceof ApiError && e.code === "SLOT_TAKEN") {
        toast.error("That slot was just taken by another booking.");
      } else {
        toast.error(errorMessage(e));
      }
    },
  });

  return (
    <>
      <PageHeading
        title="Bookings"
        description="All confirmed and historical bookings for this tenant."
      />

      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={filters.fromDate}
            onChange={(e) =>
              setFilters({ ...filters, fromDate: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="staff">Staff</Label>
          <select
            id="staff"
            value={filters.staffMemberId}
            onChange={(e) =>
              setFilters({ ...filters, staffMemberId: e.target.value })
            }
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All staff</option>
            {staff.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No show</option>
          </select>
        </div>
      </div>

      {bookings.isLoading && <Spinner />}
      {bookings.data && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-700">When</th>
                <th className="text-left p-3 font-medium text-slate-700">Service</th>
                <th className="text-left p-3 font-medium text-slate-700">Staff</th>
                <th className="text-left p-3 font-medium text-slate-700">Customer</th>
                <th className="text-left p-3 font-medium text-slate-700">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {bookings.data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No bookings match.
                  </td>
                </tr>
              ) : (
                bookings.data.items.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="p-3 whitespace-nowrap font-mono text-xs text-slate-700">
                      {DateTime.fromISO(b.startAt).toFormat("yyyy-LL-dd HH:mm")}
                    </td>
                    <td className="p-3">{b.service.name}</td>
                    <td className="p-3 text-slate-600">
                      {b.staffMember.displayName}
                    </td>
                    <td className="p-3">
                      {b.customer.firstName} {b.customer.lastName}
                      <p className="text-xs text-slate-500">
                        {b.customer.phone}
                      </p>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="p-3 text-right flex justify-end gap-3">
                      {(b.status === "pending" ||
                        b.status === "confirmed") && (
                        <>
                          <button
                            onClick={() => {
                              const local = DateTime.fromISO(b.startAt).toFormat(
                                "yyyy-LL-dd'T'HH:mm",
                              );
                              const next = window.prompt(
                                "New start (YYYY-MM-DDTHH:mm)",
                                local,
                              );
                              if (!next) return;
                              const dt = DateTime.fromISO(next);
                              if (!dt.isValid) {
                                toast.error("Invalid date/time.");
                                return;
                              }
                              reschedule.mutate({
                                id: b.id,
                                newStartAt: dt.toUTC().toISO()!,
                              });
                            }}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Cancel this booking?")) {
                                cancel.mutate(b.id);
                              }
                            }}
                            className="text-red-700 hover:underline text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
