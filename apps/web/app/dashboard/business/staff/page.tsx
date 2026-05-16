"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { businessApi } from "@/lib/api/business";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

export default function BusinessStaffPage() {
  const toast = useToast();
  const confirm = useConfirm();
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

  async function onDeactivate(m: { id: string; displayName: string }) {
    const ok = await confirm({
      title: `Deactivate "${m.displayName}"?`,
      description: "Existing bookings stay assigned to them.",
      confirmText: "Deactivate",
      tone: "destructive",
    });
    if (ok) remove.mutate(m.id);
  }

  return (
    <>
      <PageHeading
        title="Staff"
        description="Manage who can perform bookings and which services they do."
        actions={
          <Button onClick={() => setCreating(true)} leadingIcon={<Plus />}>
            New staff
          </Button>
        }
      />

      {staff.isLoading && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-0"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-16 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {staff.data && staff.data.length === 0 && (
        <EmptyState
          icon={Users}
          title="No staff yet"
          description="Add the people who can be booked for appointments."
          action={
            <Button onClick={() => setCreating(true)} leadingIcon={<Plus />}>
              Add staff member
            </Button>
          }
        />
      )}

      {/* MOBILE: card list with avatar */}
      {staff.data && staff.data.length > 0 && (
        <ul className="space-y-2 md:hidden">
          {staff.data.map((m) => {
            const initials =
              m.displayName
                .split(" ")
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "?";
            return (
              <li key={m.id}>
                <article className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">
                        {m.displayName}
                      </p>
                      <StatusBadge
                        status={m.isActive ? "active" : "inactive"}
                        variant={m.isActive ? "success" : "neutral"}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => setAssigning(m.id)}
                    >
                      Services
                    </Button>
                    {m.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-destructive hover:bg-destructive/10"
                        onClick={() => onDeactivate(m)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {/* DESKTOP: table */}
      {staff.data && staff.data.length > 0 && (
        <div className="hidden md:block rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium text-foreground">Name</th>
                <th className="text-left p-3 font-medium text-foreground">Linked user</th>
                <th className="text-left p-3 font-medium text-foreground">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {staff.data.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">
                    {m.displayName}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {m.userId ?? "—"}
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      status={m.isActive ? "active" : "inactive"}
                      variant={m.isActive ? "success" : "neutral"}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAssigning(m.id)}
                      >
                        Services
                      </Button>
                      {m.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => onDeactivate(m)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StaffCreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setCreating(false);
          void qc.invalidateQueries({ queryKey: ["business-staff"] });
        }}
      />

      {services.data && (
        <StaffServiceAssignDialog
          staffId={assigning}
          allServices={services.data}
          onOpenChange={(next) => !next && setAssigning(null)}
        />
      )}
    </>
  );
}

function StaffCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () =>
      businessApi.staff.create({ displayName: name, isActive: true }),
    onSuccess: () => {
      toast.success(`Staff "${name}" created.`);
      setName("");
      onCreated();
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
            <DialogTitle>New staff member</DialogTitle>
            <DialogDescription>
              The display name customers will see on your storefront.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="staff-name">Display name</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marko Petrov"
              required
              autoFocus
            />
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
              Add staff
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StaffServiceAssignDialog({
  staffId,
  allServices,
  onOpenChange,
}: {
  staffId: string | null;
  allServices: { id: string; name: string }[];
  onOpenChange: (next: boolean) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const open = staffId !== null;
  const current = useQuery({
    queryKey: ["business-staff-services", staffId],
    enabled: open && staffId !== null,
    queryFn: () => businessApi.staff.listAssignedServices(staffId!),
  });
  const [selected, setSelected] = useState<Set<string> | null>(null);

  // Re-sync the local checkbox set whenever the modal opens with a new
  // staffId — otherwise reopening would show the previous staff's picks.
  useEffect(() => {
    if (!open) setSelected(null);
  }, [open, staffId]);
  useEffect(() => {
    if (current.data && selected === null) {
      setSelected(new Set(current.data.map((s) => s.id)));
    }
  }, [current.data, selected]);

  const save = useMutation({
    mutationFn: () =>
      businessApi.staff.replaceServices(staffId!, Array.from(selected ?? [])),
    onSuccess: () => {
      toast.success("Assignments saved.");
      void qc.invalidateQueries({
        queryKey: ["business-staff-services", staffId],
      });
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign services</DialogTitle>
          <DialogDescription>
            Tick every service this staff member can perform.
          </DialogDescription>
        </DialogHeader>
        {current.isLoading || !selected ? (
          <Spinner label="Loading current assignments…" />
        ) : allServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Create at least one service first.
          </p>
        ) : (
          <ScrollArea className="max-h-72">
            <ul className="space-y-1 pr-3">
              {allServices.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <span className="text-sm">{s.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !selected}
            loading={save.isPending}
          >
            Save assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
