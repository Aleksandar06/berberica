/**
 * UI translation keys for the Berberica web app.
 *
 * Single source of truth — every translatable string in the app has a key
 * here, and every locale (en, mk) must provide a value for every key. The
 * `Dictionary` type acts as a compile-time check: adding a key in one
 * locale without the other won't typecheck.
 *
 * Key naming:
 *   • Dotted namespaces by area ("nav.today", "auth.signIn.title").
 *   • Camelcase within a segment to stay JS-friendly.
 *   • Plurals expressed as functions taking a count — see `bookings.count`.
 *
 * Why not next-intl / next-international: this app's whole i18n surface
 * fits in ~500 keys with no URL-routing requirement. A custom provider is
 * 30 lines and avoids the bundle + framework lock-in cost.
 */

export type Locale = "en" | "mk";
export const LOCALES: readonly Locale[] = ["en", "mk"] as const;
export const DEFAULT_LOCALE: Locale = "en";

export interface LocaleMeta {
  label: string;
  native: string;
  flag: string; // emoji flag — terse switcher labels
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { label: "English", native: "English", flag: "🇬🇧" },
  mk: { label: "Macedonian", native: "Македонски", flag: "🇲🇰" },
};

// ===========================================================================
// THE DICTIONARY SHAPE
// ===========================================================================

export interface Dictionary {
  // Common — used by buttons, dialogs, status, errors across the app.
  common: {
    save: string;
    cancel: string;
    discard: string;
    continue: string;
    back: string;
    next: string;
    delete: string;
    deactivate: string;
    reschedule: string;
    edit: string;
    add: string;
    remove: string;
    close: string;
    confirm: string;
    loading: string;
    retry: string;
    tryAgain: string;
    today: string;
    tomorrow: string;
    yesterday: string;
    upcoming: string;
    past: string;
    inView: string;
    bookings: (n: number) => string;
    min: string;
    bookNow: string;
  };

  // Status badges (booking + tenant). Mirrors the keys returned by the API.
  status: {
    active: string;
    suspended: string;
    inactive: string;
    pending: string;
    confirmed: string;
    cancelled: string;
    completed: string;
    no_show: string;
  };

  // Top-level nav (sidebar + bottom tabs).
  nav: {
    today: string;
    bookings: string;
    staff: string;
    services: string;
    earnings: string;
    availability: string;
    capacityPreview: string;
    settings: string;
    myBookings: string;
    platformOverview: string;
    tenants: string;
  };

  // Public landing page (/).
  landing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    findBusiness: string;
    forBusinessOwners: string;
    signIn: string;
    getStarted: string;
    featuresHeading: string;
    feature1Title: string;
    feature1Body: string;
    feature2Title: string;
    feature2Body: string;
    feature3Title: string;
    feature3Body: string;
    featuredHeading: string;
    footer: string;
  };

  // Auth screens (login, register, verify email).
  auth: {
    layoutTitle: string;
    layoutSubtitle: string;
    perk1: string;
    perk2: string;
    perk3: string;
    signInTitle: string;
    signInSubtitle: string;
    signInError: string;
    registerTitle: string;
    registerSubtitle: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    signInCta: string;
    registerCta: string;
    haveAccount: string;
    noAccount: string;
    createAccount: string;
    devCredentials: string;
    devCredentialsHint: string;
    verifyingTitle: string;
    verifyingSubtitle: string;
    verifiedTitle: string;
    verifiedSubtitle: string;
    verifyContinue: string;
    verifyBackHome: string;
    verifyErrorTitle: string;
    verifyErrorDefault: string;
    verifyResendIntro: string;
    verifyResendButton: string;
    verifyResendSending: string;
    verifyResendSent: string;
    verifyAlreadyVerified: string;
  };

  // Tenant storefront (/[tenantSlug]).
  storefront: {
    bookAppointment: string;
    callUs: string;
    servicesHeading: string;
    servicesSubtitle: string;
    seeAll: string;
    meetTheTeam: string;
    aboutHeading: string;
    address: string;
    phone: string;
    emailLabel: string;
    timezone: string;
    poweredBy: string;
    bookingsIn: string;
    noServices: string;
    noServicesBody: string;
    suspendedTitle: string;
    suspendedBody: string;
    getDirections: string;
  };

  // Booking flow (/[tenantSlug]/book).
  booking: {
    stageService: string;
    stageStaff: string;
    stageTime: string;
    stageDetails: string;
    stageVerify: string;
    stageBooking: string;
    stageDone: string;
    pickServiceTitle: string;
    pickStaffTitle: string;
    pickStaffSubtitle: string;
    pickTimeTitle: string;
    pickTimeSubtitle: string;
    detailsTitle: string;
    morning: string;
    afternoon: string;
    evening: string;
    noSlotsTitle: string;
    noSlotsBody: string;
    couldNotLoadTimes: string;
    yourAppointment: string;
    durationMin: string;
    summaryWith: string;
    detailsFirstName: string;
    detailsLastName: string;
    detailsPhone: string;
    detailsEmail: string;
    detailsNote: string;
    detailsContinue: string;
    otpTitle: string;
    otpSubtitle: string;
    otpResend: string;
    otpResendIn: (seconds: number) => string;
    otpSending: string;
    otpVerifyButton: string;
    otpRequestErrorIntro: string;
    otpRetry: string;
    otpRetrying: string;
    confirmingTitle: string;
    confirmingBody: string;
    confirmedTitle: string;
    confirmedBody: string;
    confirmedRef: string;
    addToCalendar: string;
    backToTenant: (name: string) => string;
    bookAnother: string;
    askForPrice: string;
    firstAvailable: string;
    anyAvailable: string;
    submitErrorGeneric: string;
  };

  // Customer dashboard (/dashboard/customer).
  customer: {
    title: string;
    descriptionEmpty: string;
    upcoming: string;
    pastCancelled: string;
    noBookingsTitle: string;
    noBookingsBody: string;
    cancelConfirmTitle: string;
    cancelConfirmYes: string;
    cancelConfirmNo: string;
    rebook: string;
  };

  // Today / business overview.
  today: {
    title: string;
    descriptionEmpty: string;
    bookedToday: string;
    arrived: string;
    noShows: string;
    quietDayTitle: string;
    quietDayBody: string;
    schedule: string;
    nothingBooked: string;
    nextUpLabel: string;
    nowLabel: string;
    inProgressNow: string;
    startingNow: string;
    inMinutes: (n: number) => string;
    inAboutAnHour: string;
    atTime: (time: string) => string;
    markArrived: string;
    markedArrived: string;
    markCompleted: string;
    markNoShow: string;
    addWalkIn: string;
    addWalkInHelper: string;
    viewWeek: string;
    viewWeekHelper: string;
    blockTime: string;
    blockTimeHelper: string;
    glanceTitle: string;
    glanceSlot: string;
    glanceLeadTime: string;
    glanceMaxDays: string;
    glanceGuests: string;
    glanceGuestsAllowed: string;
    glanceGuestsOff: string;
    earningsCardTitle: string;
    earned: string;
    projected: string;
    noShowConfirmTitle: (name: string) => string;
    noShowConfirmBody: string;
    noShowConfirmYes: string;
    noShowConfirmNo: string;
    cancelConfirmTitle: string;
    cancelConfirmBody: (service: string, name: string) => string;
    cancelBookingButton: string;
    keepBookingButton: string;
    markedNoShow: string;
    markedCompleted: string;
    bookingCancelled: string;
    bookingRescheduled: string;
  };

  // Bookings list / week calendar.
  bookings: {
    title: string;
    descriptionEmpty: string;
    todayCount: string;
    upcoming: string;
    inView: string;
    viewList: string;
    viewCalendar: string;
    filterFrom: string;
    filterTo: string;
    filterStaff: string;
    filterAllStaff: string;
    filterStatus: string;
    filterAnyStatus: string;
    filterClear: string;
    filterCalendarHint: string;
    filterListHint: string;
    noMatchTitle: string;
    noMatchBody: string;
    tableWhen: string;
    tableService: string;
    tableWith: string;
    tableCustomer: string;
    tableStatus: string;
    weekCalendarPrev: string;
    weekCalendarNext: string;
    weekCalendarToday: string;
    cancelButton: string;
    rescheduleButton: string;
    legendConfirmed: string;
    legendPending: string;
    legendCompleted: string;
    legendCancelled: string;
    legendNoShow: string;
  };

  // Services page + create dialog.
  services: {
    title: string;
    descriptionDefault: string;
    bookable: string;
    archived: string;
    newService: string;
    noServicesTitle: string;
    noServicesBody: string;
    firstServiceButton: string;
    tableName: string;
    tablePrice: string;
    tableDuration: string;
    tableBuffers: string;
    tableStatus: string;
    dialogTitle: string;
    dialogSubtitle: string;
    fieldName: string;
    fieldNamePlaceholder: string;
    fieldDescription: string;
    fieldDescriptionPlaceholder: string;
    fieldPriceLabel: (currency: string) => string;
    fieldPricePlaceholder: string;
    fieldPriceHelper: string;
    fieldDuration: string;
    fieldBufferBefore: string;
    fieldBufferAfter: string;
    createService: string;
    deactivateTitle: (name: string) => string;
    deactivateBody: string;
    serviceCreatedToast: (name: string) => string;
    serviceDeactivatedToast: string;
  };

  // Staff page.
  staff: {
    title: string;
    descriptionDefault: string;
    activeCount: string;
    inactiveCount: string;
    newStaff: string;
    noStaffTitle: string;
    noStaffBody: string;
    addStaffButton: string;
    tableName: string;
    tableLinkedUser: string;
    tableStatus: string;
    servicesAction: string;
    deactivateAction: string;
    deactivateTitle: (name: string) => string;
    deactivateBody: string;
    deactivatedToast: string;
  };

  // Earnings page.
  earnings: {
    title: string;
    descriptionEmpty: string;
    descriptionDefault: string;
    presetToday: string;
    preset7Days: string;
    preset30Days: string;
    presetCustom: string;
    from: string;
    to: string;
    kpiEarned: string;
    kpiProjected: string;
    kpiLost: string;
    kpiEarnedSub: (n: number) => string;
    kpiProjectedSub: (n: number) => string;
    kpiLostSub: (n: number) => string;
    chartTitle: string;
    legendEarned: string;
    legendProjected: string;
    topServices: string;
    topStaff: string;
    noRevenueServices: string;
    noRevenueStaff: string;
    emptyTitle: string;
    emptyBody: string;
    shareSuffix: (n: number) => string;
  };

  // Tenant settings (Profile / Booking policy / Branding tabs).
  settings: {
    title: string;
    subtitle: string;
    tabProfile: string;
    tabPolicy: string;
    tabBranding: string;
    saved: string;
  };

  // Common empty state / fallback strings.
  empty: {
    noBookingsMatch: string;
    nothingToShow: string;
    askForPrice: string;
  };

  // Currency selector / earnings reports.
  pricing: {
    currency: string;
    askForPrice: string;
  };
}
