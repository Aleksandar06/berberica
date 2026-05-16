"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { businessApi, type Service } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

export default function BusinessServicesPage() {
  const toast = useToast();
  const confirm = useConfirm();
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

  async function onDeactivate(s: Service) {
    const ok = await confirm({
      title: `Deactivate "${s.name}"?`,
      description:
        "It stops appearing in storefront search. Existing bookings stay assigned.",
      confirmText: "Deactivate",
      tone: "destructive",
    });
    if (ok) remove.mutate(s.id);
  }

  return (
    <>
      <PageHeading
        title="Services"
        description="Active services are bookable on your storefront. Soft-deleted ones live on for booking history."
        actions={
          <Button onClick={() => setCreating(true)} leadingIcon={<Plus />}>
            New service
          </Button>
        }
      />

      {services.isLoading && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-16 ml-auto" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      )}

      {services.data && services.data.length === 0 && (
        <EmptyState
          title="No services yet"
          description="Add the things customers can book — haircuts, treatments, consultations."
          action={
            <Button onClick={() => setCreating(true)} leadingIcon={<Plus />}>
              Create your first service
            </Button>
          }
        />
      )}

      {/* MOBILE: card list */}
      {services.data && services.data.length > 0 && (
        <ul className="space-y-2 md:hidden">
          {services.data.map((s) => (
            <li key={s.id}>
              <article className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">
                      {s.name}
                    </p>
                    {s.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    status={s.isActive ? "active" : "inactive"}
                    variant={s.isActive ? "success" : "neutral"}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {s.durationMinutes} min ·{" "}
                    <span className="text-xs">
                      {s.bufferBeforeMinutes}b / {s.bufferAfterMinutes}a
                    </span>
                  </p>
                  {s.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => onDeactivate(s)}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/* DESKTOP: table */}
      {services.data && services.data.length > 0 && (
        <div className="hidden md:block rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium text-foreground">Name</th>
                <th className="text-left p-3 font-medium text-foreground">Duration</th>
                <th className="text-left p-3 font-medium text-foreground">Buffers</th>
                <th className="text-left p-3 font-medium text-foreground">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {services.data.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <p className="font-medium text-foreground">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.description}
                      </p>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{s.durationMinutes} min</td>
                  <td className="p-3 text-muted-foreground tabular-nums">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => onDeactivate(s)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ServiceCreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setCreating(false);
          void qc.invalidateQueries({ queryKey: ["business-services"] });
        }}
      />
    </>
  );
}

function ServiceCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
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
      // Reset form for next open
      setForm({
        name: "",
        description: "",
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        isActive: true,
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New service</DialogTitle>
            <DialogDescription>
              Set the duration and buffer time around each appointment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Classic Haircut"
                required
                autoFocus
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
                placeholder="30-minute precision cut."
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
                    setForm({
                      ...form,
                      durationMinutes: Number(e.target.value),
                    })
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
                    setForm({
                      ...form,
                      bufferBeforeMinutes: Number(e.target.value),
                    })
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
                    setForm({
                      ...form,
                      bufferAfterMinutes: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
