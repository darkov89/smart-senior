import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const STAFF_ROLES: readonly AppRole[] = [
  "superadmin",
  "org_admin",
  "nurse",
];

export function roleFromUser(user: User | null): AppRole | null {
  const role = user?.app_metadata?.role;
  if (
    role === "superadmin" ||
    role === "org_admin" ||
    role === "nurse" ||
    role === "family" ||
    role === "iot_device"
  ) {
    return role;
  }
  return null;
}

export function organizationIdFromUser(user: User | null): string | null {
  const organizationId = user?.app_metadata?.organization_id;
  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
}

export function isStaffRole(role: AppRole | null): boolean {
  return role !== null && STAFF_ROLES.includes(role);
}

export function isOrgAdminRole(role: AppRole | null): boolean {
  return role === "org_admin" || role === "superadmin";
}

export function staffNeedsAal2(role: AppRole | null): boolean {
  return role === "superadmin" || role === "org_admin" || role === "nurse";
}

export function decodeJwtAal(accessToken: string | null | undefined): "aal1" | "aal2" {
  if (!accessToken) return "aal1";
  const payload = accessToken.split(".")[1];
  if (!payload) return "aal1";
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);
    const claims = JSON.parse(json) as { aal?: unknown };
    return claims.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

export function homePathForRole(role: AppRole | null): string {
  if (role === "family") return "/rodzina";
  if (isStaffRole(role)) return "/placowka";
  return "/logowanie";
}
