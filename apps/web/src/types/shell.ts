import type { Permission } from "@ai-ems/security/authorization/permissions";

/** Identity shown in the shell. Resolved on the server (Phase 3). */
export interface ShellUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  title?: string | null;
}

/** Organization the user is working in. Resolved on the server (Phase 4). */
export interface ShellOrganization {
  id: string;
  slug: string;
  name: string;
  plan: "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
  logoUrl?: string | null;
}

/** A workspace notification as the shell shows it (Phase 5). */
export interface ShellNotification {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
}

export interface ShellContextValue {
  user: ShellUser;
  organization: ShellOrganization;
  organizations: ShellOrganization[];
  permissions: readonly Permission[];
  /** Prefix for every in-app link, e.g. "/demo" or "/preview/demo". */
  basePath: string;
  /** The newest few notifications for the bell menu, unread first in the count. */
  notifications?: ShellNotification[];
  unreadNotifications?: number;
  /** Preview mode disables actions that need a session (sign out, etc.). */
  preview?: boolean;
}
