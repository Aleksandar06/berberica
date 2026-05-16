"use client";

import {
  LogOut,
  Settings,
  UserCircle,
} from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/lib/auth/auth-context";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  TENANT_ADMIN: "Admin",
  STAFF: "Staff",
  CUSTOMER: "Customer",
};

/**
 * Top-right account menu in the dashboard shell. Surface the user's
 * identity + role + a clean sign-out path. Settings deep-link goes to
 * the business settings page when relevant; admins/customers don't get
 * that shortcut (their roles don't own per-tenant settings).
 */
export function UserMenu() {
  const { user, memberships, logout } = useAuth();
  if (!user) return null;

  // Pick the dominant role for the chip — highest privilege wins.
  const dominantRole =
    memberships.find((m) => m.role === "SUPER_ADMIN")?.role ??
    memberships.find((m) => m.role === "TENANT_ADMIN")?.role ??
    memberships.find((m) => m.role === "STAFF")?.role ??
    "CUSTOMER";
  const isBusiness =
    dominantRole === "TENANT_ADMIN" || dominantRole === "STAFF";

  const initials =
    (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "") ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open account menu"
          className="rounded-full"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal normal-case tracking-normal text-foreground">
          <div className="flex items-start gap-3 px-1 py-1">
            <Avatar className="h-10 w-10 mt-0.5">
              <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium truncate">
                {user.firstName || user.lastName
                  ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                  : user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
              <Badge variant="secondary" className="mt-1">
                {ROLE_LABEL[dominantRole] ?? dominantRole}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <UserCircle className="h-4 w-4" />
            My dashboard
          </Link>
        </DropdownMenuItem>
        {isBusiness && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/business/settings">
              <Settings className="h-4 w-4" />
              Business settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={() => {
            void logout();
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
