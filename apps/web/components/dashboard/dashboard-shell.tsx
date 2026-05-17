"use client";

import { Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/dashboard/user-menu";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  /** Lucide icon component. Required for the new shell — pass any icon. */
  icon: LucideIcon;
  /**
   * Show in the mobile bottom tab bar. Cap at 3 per role — the 4th slot is
   * the "More" button that opens the full nav drawer. If more than 3 items
   * are flagged, only the first 3 are surfaced.
   */
  mobileTab?: boolean;
  /** Hide on the desktop sidebar — useful for tertiary actions. */
  hideOnDesktop?: boolean;
}

interface ShellProps {
  title: string;
  nav: NavItem[];
  children: ReactNode;
}

/**
 * Dashboard shell — mobile-first.
 *
 *   Mobile (<lg):
 *     Top bar: hamburger | wordmark + tenant pill | avatar
 *     Bottom: tab bar with 3 primary destinations + "More" (opens left Sheet)
 *
 *   Desktop (lg+):
 *     Top bar: wordmark + tenant pill | spacer | avatar
 *     Left sidebar: full nav with icons + labels
 *     No bottom bar
 *
 * Active state is matched by `startsWith` so nested routes keep their parent
 * highlighted (e.g. `/dashboard/admin/tenants/abc` keeps "Tenants" active).
 */
export function DashboardShell({ title, nav, children }: ShellProps) {
  const { memberships } = useAuth();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer whenever the route changes — without this, tapping a
  // nav item leaves the sheet open until the user dismisses it manually.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const activeBusiness = memberships.find(
    (m) => m.role === "TENANT_ADMIN" || m.role === "STAFF",
  );

  const mobileTabs = nav.filter((n) => n.mobileTab).slice(0, 3);
  const hasMobileNav = nav.length > 0;
  const desktopNav = nav.filter((n) => !n.hideOnDesktop);

  function isActive(href: string): boolean {
    if (pathname === href) return true;
    // Don't let the dashboard root match every subroute.
    if (href === "/dashboard" || href.endsWith("/business") || href.endsWith("/admin") || href.endsWith("/customer")) {
      return pathname === href;
    }
    return pathname.startsWith(href + "/") || pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* ============================ TOP BAR ============================ */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 h-14 px-3 sm:px-6">
          {/* Mobile hamburger */}
          {hasMobileNav && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden -ml-1"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu />
            </Button>
          )}

          {/* Brand + active tenant */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 min-w-0 group"
          >
            <LogoMark />
            <span className="font-semibold text-foreground truncate">
              Berberica
            </span>
          </Link>

          {activeBusiness && (
            <>
              <span aria-hidden className="text-border hidden sm:inline">
                /
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground truncate max-w-[12rem]">
                {activeBusiness.tenantName}
              </span>
            </>
          )}

          <span className="flex-1" />

          {/* Page title on desktop — gives some left-anchor to the avatar */}
          <span className="hidden lg:inline text-sm text-muted-foreground truncate max-w-xs">
            {title}
          </span>

          <UserMenu />
        </div>
      </header>

      {/* ============================ LAYOUT ============================= */}
      <div className="flex-1 flex w-full">
        {/* Desktop sidebar */}
        {hasMobileNav && (
          <aside
            aria-label="Dashboard navigation"
            className="hidden lg:flex w-60 shrink-0 border-r border-border bg-background flex-col sticky top-14 self-start max-h-[calc(100vh-3.5rem)]"
          >
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {desktopNav.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                />
              ))}
            </nav>
          </aside>
        )}

        {/* Main content area */}
        <main
          className={cn(
            "flex-1 min-w-0",
            // Leave room for the mobile bottom bar (h-16) + safe-area.
            "pb-24 lg:pb-8",
          )}
        >
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* ============================ BOTTOM TABS ======================== */}
      {hasMobileNav && (
        <nav
          aria-label="Primary navigation"
          className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur pb-safe"
        >
          <ul className="grid grid-cols-4 h-16">
            {mobileTabs.map((item) => (
              <li key={item.href}>
                <BottomTab item={item} active={isActive(item.href)} />
              </li>
            ))}
            {/* Pad to 3 if fewer (keeps the "More" tab anchored right) */}
            {Array.from({ length: Math.max(0, 3 - mobileTabs.length) }).map(
              (_, i) => (
                <li key={`pad-${i}`} aria-hidden />
              ),
            )}
            <li>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full h-full text-xs font-medium transition",
                  "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Open more navigation"
              >
                <Menu className="h-5 w-5" />
                More
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* ============================ DRAWER ============================= */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="p-6 pb-3 mb-0">
            <SheetTitle className="flex items-center gap-2">
              <LogoMark />
              Berberica
            </SheetTitle>
            <SheetDescription>{title}</SheetDescription>
          </SheetHeader>
          <Separator />
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {nav.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ===========================================================================
// PIECES
// ===========================================================================

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function BottomTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-1 w-full h-full text-xs font-medium transition",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}
