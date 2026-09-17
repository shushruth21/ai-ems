import type { Permission } from "@/server/auth/permissions";

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

export interface ShellContextValue {
  user: ShellUser;
  organization: ShellOrganization;
  organizations: ShellOrganization[];
  permissions: readonly Permission[];
  /** Prefix for every in-app link, e.g. "/demo" or "/preview/demo". */
  basePath: string;
  /** Preview mode disables actions that need a session (sign out, etc.). */
  preview?: boolean;
}
