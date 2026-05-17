"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";

import { businessApi } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { StickySaveBar } from "@/components/sticky-save-bar";
import { PageHeader } from "@/components/page-header";
import { errorMessage, useToast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

export default function BusinessSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Business profile, booking policy, and brand colors."
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile" className="flex-1 sm:flex-initial">
            Profile
          </TabsTrigger>
          <TabsTrigger value="policy" className="flex-1 sm:flex-initial">
            Booking policy
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex-1 sm:flex-initial">
            Branding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="policy">
          <PolicyTab />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ===========================================================================
// PROFILE
// ===========================================================================

const profileSchema = z.object({
  name: z.string().min(1, "Required").max(120),
  businessType: z.string().min(1, "Required").max(60),
  timezone: z.string().min(1, "IANA timezone required").max(60),
  contactEmail: z
    .string()
    .email("Invalid email")
    .max(255)
    .or(z.literal(""))
    .nullable()
    .optional(),
  contactPhone: z.string().max(40).or(z.literal("")).nullable().optional(),
  address: z.string().max(255).or(z.literal("")).nullable().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

function ProfileTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => businessApi.profile.get(),
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      businessType: "",
      timezone: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
    },
  });

  // Re-sync when the server payload lands. Reset keeps the form's
  // baseline correct so `isDirty` accurately reflects user edits.
  useEffect(() => {
    if (q.data) {
      form.reset({
        name: q.data.name,
        businessType: q.data.businessType,
        timezone: q.data.timezone,
        contactEmail: q.data.contactEmail ?? "",
        contactPhone: q.data.contactPhone ?? "",
        address: q.data.address ?? "",
      });
    }
  }, [q.data, form]);

  const update = useMutation({
    mutationFn: (values: ProfileForm) =>
      businessApi.profile.update({
        name: values.name,
        businessType: values.businessType,
        timezone: values.timezone,
        contactEmail: values.contactEmail || null,
        contactPhone: values.contactPhone || null,
        address: values.address || null,
      }),
    onSuccess: () => {
      toast.success("Profile updated.");
      void qc.invalidateQueries({ queryKey: ["business-profile"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onSubmit: SubmitHandler<ProfileForm> = (values) => update.mutate(values);

  if (q.isLoading) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Business profile"
      description="What customers see on your storefront."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="businessType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. barbershop, dental_clinic"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone (IANA)</FormLabel>
                  <FormControl>
                    <Input placeholder="Europe/Skopje" {...field} />
                  </FormControl>
                  <FormDescription>
                    All times are shown to customers in this zone.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact phone</FormLabel>
                <FormControl>
                  <Input
                    placeholder="+38970555000"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <StickySaveBar
        visible={form.formState.isDirty}
        saving={update.isPending}
        onSave={() => form.handleSubmit(onSubmit)()}
        onDiscard={() => form.reset()}
      />
    </SettingsCard>
  );
}

// ===========================================================================
// BOOKING POLICY
// ===========================================================================

const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

const policySchema = z.object({
  defaultSlotDurationMinutes: z.number().int().min(1).max(720),
  bookingLeadTimeMinutes: z.number().int().min(0).max(43200),
  bookingMaxDaysAhead: z.number().int().min(0).max(365),
  allowGuestBooking: z.boolean(),
  allowCustomerCancellation: z.boolean(),
  cancellationCutoffMinutes: z.number().int().min(0).max(43200),
  allowCustomerReschedule: z.boolean(),
  rescheduleCutoffMinutes: z.number().int().min(0).max(43200),
  requireVerifiedAccountForBooking: z.boolean(),
});
type PolicyForm = z.infer<typeof policySchema>;

function PolicyTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => businessApi.settings.get(),
  });

  const form = useForm<PolicyForm>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      defaultSlotDurationMinutes: 15,
      bookingLeadTimeMinutes: 0,
      bookingMaxDaysAhead: 60,
      allowGuestBooking: true,
      allowCustomerCancellation: true,
      cancellationCutoffMinutes: 120,
      allowCustomerReschedule: true,
      rescheduleCutoffMinutes: 120,
      requireVerifiedAccountForBooking: false,
    },
  });

  useEffect(() => {
    if (q.data) form.reset(q.data);
  }, [q.data, form]);

  const update = useMutation({
    mutationFn: (values: PolicyForm) => businessApi.settings.update(values),
    onSuccess: () => {
      toast.success("Booking policy updated.");
      void qc.invalidateQueries({ queryKey: ["business-settings"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onSubmit: SubmitHandler<PolicyForm> = (values) => update.mutate(values);

  if (q.isLoading) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Booking policy"
      description="How customers can book, cancel, and reschedule."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4">
            <SectionLabel>Scheduling</SectionLabel>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="defaultSlotDurationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default slot duration</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SLOT_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bookingLeadTimeMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead time (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum minutes between now and a bookable slot.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bookingMaxDaysAhead"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max days ahead</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      How far in the future customers can book.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="space-y-4 pt-6 border-t border-border">
            <SectionLabel>Customer actions</SectionLabel>
            <div className="space-y-1">
              <SwitchRow
                label="Allow guest booking"
                description="Customers without an account can book using just an email + OTP."
                form={form}
                name="allowGuestBooking"
              />
              <SwitchRow
                label="Require a verified account to book"
                description="Logged-in customers must have verified their email before booking."
                form={form}
                name="requireVerifiedAccountForBooking"
              />
            </div>
            <div className="pt-2 space-y-1">
              <SwitchRow
                label="Allow customer cancellation"
                form={form}
                name="allowCustomerCancellation"
              />
              {form.watch("allowCustomerCancellation") && (
                <FormField
                  control={form.control}
                  name="cancellationCutoffMinutes"
                  render={({ field }) => (
                    <FormItem className="pl-4 max-w-xs">
                      <FormLabel>Cancellation cutoff (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        How close to the appointment they can still cancel.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <div className="space-y-1">
              <SwitchRow
                label="Allow customer reschedule"
                form={form}
                name="allowCustomerReschedule"
              />
              {form.watch("allowCustomerReschedule") && (
                <FormField
                  control={form.control}
                  name="rescheduleCutoffMinutes"
                  render={({ field }) => (
                    <FormItem className="pl-4 max-w-xs">
                      <FormLabel>Reschedule cutoff (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        How close to the appointment they can still reschedule.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </section>
        </form>
      </Form>

      <StickySaveBar
        visible={form.formState.isDirty}
        saving={update.isPending}
        onSave={() => form.handleSubmit(onSubmit)()}
        onDiscard={() => form.reset()}
      />
    </SettingsCard>
  );
}

// ===========================================================================
// BRANDING
// ===========================================================================

const colorHex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/i, "Hex color like #112233 required");
const brandingSchema = z.object({
  logoUrl: z.string().url("Must be a URL").or(z.literal("")),
  primaryColor: colorHex,
  secondaryColor: colorHex,
  accentColor: colorHex,
});
type BrandingForm = z.infer<typeof brandingSchema>;

function BrandingTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["business-branding"],
    queryFn: () => businessApi.branding.get(),
  });

  const form = useForm<BrandingForm>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logoUrl: "",
      primaryColor: "#1f2937",
      secondaryColor: "#3b82f6",
      accentColor: "#f59e0b",
    },
  });

  useEffect(() => {
    if (q.data) {
      form.reset({
        logoUrl: q.data.logoUrl ?? "",
        primaryColor: q.data.primaryColor ?? "#1f2937",
        secondaryColor: q.data.secondaryColor ?? "#3b82f6",
        accentColor: q.data.accentColor ?? "#f59e0b",
      });
    }
  }, [q.data, form]);

  const update = useMutation({
    mutationFn: (values: BrandingForm) =>
      businessApi.branding.update({
        logoUrl: values.logoUrl || null,
        primaryColor: values.primaryColor || null,
        secondaryColor: values.secondaryColor || null,
        accentColor: values.accentColor || null,
      }),
    onSuccess: () => {
      toast.success("Branding updated.");
      void qc.invalidateQueries({ queryKey: ["business-branding"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onSubmit: SubmitHandler<BrandingForm> = (values) =>
    update.mutate(values);

  // Live preview pulls from `watch()` so the storefront header mock
  // updates as the user drags the color picker.
  const live = form.watch();
  const profileQ = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => businessApi.profile.get(),
  });

  if (q.isLoading) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Branding"
      description="Customise how your storefront looks to customers."
    >
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://…"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Direct file upload lands in a future release. For now,
                    paste a public image URL.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid sm:grid-cols-3 gap-4">
              <ColorField form={form} name="primaryColor" label="Primary" />
              <ColorField form={form} name="secondaryColor" label="Secondary" />
              <ColorField form={form} name="accentColor" label="Accent" />
            </div>
          </form>
        </Form>

        <BrandPreview
          name={profileQ.data?.name ?? "Your business"}
          primaryColor={live.primaryColor}
          accentColor={live.accentColor}
          logoUrl={live.logoUrl || null}
        />
      </div>

      <StickySaveBar
        visible={form.formState.isDirty}
        saving={update.isPending}
        onSave={() => form.handleSubmit(onSubmit)()}
        onDiscard={() => form.reset()}
      />
    </SettingsCard>
  );
}

function BrandPreview({
  name,
  primaryColor,
  accentColor,
  logoUrl,
}: {
  name: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}) {
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <aside className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Storefront preview
      </p>
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-card">
        {/* Faux browser chrome to make it feel like a window */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-b border-border">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        </div>
        {/* Branded header */}
        <div
          className="px-4 py-3.5 flex items-center justify-between gap-3"
          style={{ backgroundColor: primaryColor, color: "#fff" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-7 w-7 rounded bg-white object-contain p-0.5"
              />
            ) : (
              <span className="h-7 w-7 rounded bg-white/20 grid place-items-center text-xs font-bold">
                {initial}
              </span>
            )}
            <span className="font-semibold truncate">{name}</span>
          </div>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            Book now
          </span>
        </div>
        {/* Service card */}
        <div className="p-4 space-y-3">
          <div className="rounded-xl border border-border p-3">
            <div className="flex justify-between items-start gap-3">
              <p className="font-semibold text-foreground text-sm">
                Classic Haircut
              </p>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${accentColor}22`,
                  color: accentColor,
                }}
              >
                30 min
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              30-minute precision cut.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="w-full rounded-full py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Book this service
          </button>
        </div>
      </div>
    </aside>
  );
}

// ===========================================================================
// PRIMITIVES
// ===========================================================================

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-h2 text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

type BooleanPolicyKey =
  | "allowGuestBooking"
  | "allowCustomerCancellation"
  | "allowCustomerReschedule"
  | "requireVerifiedAccountForBooking";

function SwitchRow({
  label,
  description,
  form,
  name,
}: {
  label: string;
  description?: string;
  form: ReturnType<typeof useForm<PolicyForm>>;
  name: BooleanPolicyKey;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start gap-4 justify-between space-y-0 py-2">
          <div className="space-y-0.5">
            <FormLabel className="text-sm font-medium text-foreground mb-0 cursor-pointer">
              {label}
            </FormLabel>
            {description && (
              <FormDescription>{description}</FormDescription>
            )}
          </div>
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function ColorField({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<BrandingForm>>;
  name: keyof BrandingForm;
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className={cn("flex items-center gap-2 rounded-lg border border-input bg-background pr-2 transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1")}>
            <input
              type="color"
              value={field.value || "#000000"}
              onChange={(e) => field.onChange(e.target.value)}
              aria-label={`${label} color`}
              className="h-10 w-12 rounded-l-lg border-r border-input cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="flex-1 bg-transparent text-sm font-mono outline-none placeholder:text-muted-foreground"
            />
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-72" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
