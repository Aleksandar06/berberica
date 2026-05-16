"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { businessApi, type Service } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

export default function BusinessServicesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const services = useQuery({
    queryKey: ["business-services"],
    queryFn: () => businessApi.services.list(),
  });

  const [creating, setCreating] = useState(false);

  const remove = useMutation({
    mutationFn: (id: string) => businessApi.services.delete(id),
    onSuccess: () => {
      toast.success("Service deactivated.");
      void qc.invalidateQueries({ queryKey: ["business-services"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeading
        title="Services"
        description="Active services are bookable on your storefront. Soft-deleted ones live on for booking history."
        actions={
          <Button onClick={() => setCreating(true)}>New service</Button>
        }
      />

      {services.isLoading && <Spinner />}

      {services.data && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-700">Name</th>
                <th className="text-left p-3 font-medium text-slate-700">Duration</th>
                <th className="text-left p-3 font-medium text-slate-700">Buffers</th>
                <th className="text-left p-3 font-medium text-slate-700">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {services.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No services yet. Click &quot;New service&quot; above.
                  </td>
                </tr>
              ) : (
                services.data.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.description}
                        </p>
                      )}
                    </td>
                    <td className="p-3">{s.durationMinutes} min</td>
                    <td className="p-3 text-slate-600">
                      {s.bufferBeforeMinutes}b · {s.bufferAfterMinutes}a
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        status={s.isActive ? "active" : "inactive"}
                        variant={s.isActive ? "success" : "neutral"}
                      />
                    </td>
                    <td className="p-3 text-right">
                      {s.isActive && (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Deactivate "${s.name}"? It stops appearing in storefront search but existing bookings stay.`,
                              )
                            ) {
                              remove.mutate(s.id);
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
        <ServiceCreate
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: ["business-services"] });
          }}
        />
      )}
    </>
  );
}

function ServiceCreate({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: Service) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    isActive: true,
  });
  const create = useMutation({
    mutationFn: () =>
      businessApi.services.create({
        name: form.name,
        description: form.description || null,
        durationMinutes: form.durationMinutes,
        bufferBeforeMinutes: form.bufferBeforeMinutes,
        bufferAfterMinutes: form.bufferAfterMinutes,
        isActive: form.isActive,
      }),
    onSuccess: (s) => {
      toast.success(`Service "${s.name}" created.`);
      onCreated(s);
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
        <h2 className="text-lg font-semibold">New service</h2>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="duration">Duration (min)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={form.durationMinutes}
              onChange={(e) =>
                setForm({ ...form, durationMinutes: Number(e.target.value) })
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="before">Buffer before</Label>
            <Input
              id="before"
              type="number"
              min={0}
              value={form.bufferBeforeMinutes}
              onChange={(e) =>
                setForm({ ...form, bufferBeforeMinutes: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label htmlFor="after">Buffer after</Label>
            <Input
              id="after"
              type="number"
              min={0}
              value={form.bufferAfterMinutes}
              onChange={(e) =>
                setForm({ ...form, bufferAfterMinutes: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
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
