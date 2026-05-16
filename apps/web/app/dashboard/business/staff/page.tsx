"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { businessApi } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

export default function BusinessStaffPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const staff = useQuery({
    queryKey: ["business-staff"],
    queryFn: () => businessApi.staff.list(),
  });
  const services = useQuery({
    queryKey: ["business-services"],
    queryFn: () => businessApi.services.list(),
  });
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => businessApi.staff.delete(id),
    onSuccess: () => {
      toast.success("Staff deactivated.");
      void qc.invalidateQueries({ queryKey: ["business-staff"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeading
        title="Staff"
        description="Manage who can perform bookings and which services they do."
        actions={<Button onClick={() => setCreating(true)}>New staff</Button>}
      />

      {staff.isLoading && <Spinner />}

      {staff.data && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-700">Name</th>
                <th className="text-left p-3 font-medium text-slate-700">Linked user</th>
                <th className="text-left p-3 font-medium text-slate-700">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {staff.data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No staff yet.
                  </td>
                </tr>
              ) : (
                staff.data.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="p-3 font-medium text-slate-900">
                      {m.displayName}
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-600">
                      {m.userId ?? "—"}
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        status={m.isActive ? "active" : "inactive"}
                        variant={m.isActive ? "success" : "neutral"}
                      />
                    </td>
                    <td className="p-3 text-right flex justify-end gap-3">
                      <button
                        onClick={() => setAssigning(m.id)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Services
                      </button>
                      {m.isActive && (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deactivate "${m.displayName}"? Existing bookings stay assigned.`,
                              )
                            ) {
                              remove.mutate(m.id);
                            }
                          }}
                          className="text-red-700 hover:underline text-sm"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <StaffCreate
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ["business-staff"] });
          }}
        />
      )}

      {assigning && services.data && (
        <StaffServiceAssign
          staffId={assigning}
          allServices={services.data}
          onClose={() => setAssigning(null)}
        />
      )}
    </>
  );
}

function StaffCreate({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () =>
      businessApi.staff.create({ displayName: name, isActive: true }),
    onSuccess: () => {
      toast.success(`Staff "${name}" created.`);
      onCreated();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  return (
    <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-20">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">New staff member</h2>
        <div>
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function StaffServiceAssign({
  staffId,
  allServices,
  onClose,
}: {
  staffId: string;
  allServices: { id: string; name: string }[];
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const current = useQuery({
    queryKey: ["business-staff-services", staffId],
    queryFn: () => businessApi.staff.listAssignedServices(staffId),
  });
  const [selected, setSelected] = useState<Set<string> | null>(null);
  // Initialize selection from server data once it lands.
  if (selected === null && current.data) {
    setSelected(new Set(current.data.map((s) => s.id)));
  }
  const save = useMutation({
    mutationFn: () =>
      businessApi.staff.replaceServices(staffId, Array.from(selected ?? [])),
    onSuccess: () => {
      toast.success("Assignments saved.");
      void qc.invalidateQueries({
        queryKey: ["business-staff-services", staffId],
      });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  function toggle(id: string) {
    if (!selected) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  return (
    <div className="fixed inset-0 bg-slate-900/40 grid place-items-center p-4 z-20">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Assign services</h2>
        {current.isLoading || !selected ? (
          <Spinner />
        ) : allServices.length === 0 ? (
          <p className="text-sm text-slate-500">
            Create at least one service first.
          </p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {allServices.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="h-4 w-4"
                  />
                  {s.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !selected}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
