"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { businessApi, type Service } from "@/lib/api/business";
import {
  centsToMajor,
  formatPrice,
  majorToCents,
} from "@/lib/format/money";
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
import { PageHeader } from "@/components/page-header";
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
  const profile = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => businessApi.profile.get(),
  });
  const currency = profile.data?.currency ?? "EUR";

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
      <PageHeader
        title="Services"
        description={
          services.data
            ? (() => {
                const active = services.data.filter((s) => s.isActive).length;
                const inactive = services.data.length - active;
                return (
                  <span className="tabular-nums">
                    <strong className="text-foreground font-semibold">
                      {active}
                    </strong>{" "}
                    bookable
                    {inactive > 0 && (
                      <>
                        <span className="text-border mx-2">·</span>
                        <strong className="text-foreground font-semibold">
                          {inactive}
                        </strong>{" "}
                        archived
                      </>
                    )}
                  </span>
                );
              })()
            : "Active services are bookable on your storefront."
        }
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
                  <div className="text-sm tabular-nums">
                    <span className="font-semibold text-foreground">
                      {formatPrice(s.priceCents, currency)}
                    </span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {s.durationMinutes} min
                    </span>
                  </div>
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
        <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Price
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Duration
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Buffers
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {services.data.map((s) => (
                <tr
                  key={s.id}
                  className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-foreground">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-xl">
                        {s.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums align-top">
                    {s.priceCents === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="font-medium text-foreground">
                        {formatPrice(s.priceCents, currency)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums align-top">
                    {s.durationMinutes} min
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums align-top">
                    {s.bufferBeforeMinutes}b · {s.bufferAfterMinutes}a
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge
                      status={s.isActive ? "active" : "inactive"}
                      variant={s.isActive ? "success" : "neutral"}
                    />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                    {s.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition text-destructive hover:bg-destructive/10 hover:text-destructive"
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
        currency={currency}
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
  currency,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (s: Service) => void;
  currency: string;
}) {
  const toast = useToast();
  // Price is captured as a free-text major-unit string so the user can
  // type "25" or "9.99" naturally. Empty string = "Ask for price" (null
  // on the wire). We parse + validate on submit.
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    priceInput: "",
    isActive: true,
  });
  const create = useMutation({
    mutationFn: () => {
      const trimmed = form.priceInput.trim();
      const priceCents = trimmed === "" ? null : majorToCents(Number(trimmed));
      return businessApi.services.create({
        name: form.name,
        description: form.description || null,
        durationMinutes: form.durationMinutes,
        bufferBeforeMinutes: form.bufferBeforeMinutes,
        bufferAfterMinutes: form.bufferAfterMinutes,
        priceCents,
        isActive: form.isActive,
      });
    },
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
        priceInput: "",
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
            <div>
              <Label htmlFor="price">Price ({currency})</Label>
              <Input
                id="price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="Leave empty for &quot;Ask for price&quot;"
                value={form.priceInput}
                onChange={(e) =>
                  setForm({ ...form, priceInput: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Per-appointment. Used to compute earnings on your dashboard.
              </p>
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
