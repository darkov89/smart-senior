import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const STAFF_ROLES: readonly AppRole[] = [
  "superadmin",
  "org_admin",
  "nurse",
];

function parseAppRole(value: unknown): AppRole | null {
  if (
    value === "superadmin" ||
    value === "org_admin" ||
    value === "nurse" ||
    value === "family" ||
    value === "iot_device"
  ) {
    return value;
  }
  return null;
}

function decodeJwtPayload(
  accessToken: string | null | undefined,
): Record<string, unknown> | null {
  if (!accessToken) return null;
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const parsed: unknown = JSON.parse(atob(padded));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function jwtAppMetadata(
  accessToken: string | null | undefined,
): Record<string, unknown> | null {
  const claims = decodeJwtPayload(accessToken);
  const metadata = claims?.app_metadata;
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

export function roleFromUnknown(value: unknown): AppRole | null {
  return parseAppRole(value);
}

export function roleFromUser(user: User | null): AppRole | null {
  return parseAppRole(user?.app_metadata?.role);
}

export function roleFromAccessToken(
  accessToken: string | null | undefined,
): AppRole | null {
  return parseAppRole(jwtAppMetadata(accessToken)?.role);
}

export function resolveAppRole(
  user: User | null,
  accessToken?: string | null,
): AppRole | null {
  return roleFromUser(user) ?? roleFromAccessToken(accessToken);
}

export function organizationIdFromUser(user: User | null): string | null {
  const organizationId = user?.app_metadata?.organization_id;
  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
}

export function resolveOrganizationId(
  user: User | null,
  accessToken?: string | null,
): string | null {
  const fromUser = organizationIdFromUser(user);
  if (fromUser) return fromUser;
  const organizationId = jwtAppMetadata(accessToken)?.organization_id;
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
  const claims = decodeJwtPayload(accessToken);
  return claims?.aal === "aal2" ? "aal2" : "aal1";
}

export function homePathForRole(role: AppRole | null): string {
  if (role === "family") return "/rodzina";
  if (isStaffRole(role)) return "/placowka";
  return "/logowanie";
}

export function destinationAfterAuth(
  role: AppRole | null,
  aal: "aal1" | "aal2",
): string | null {
  if (staffNeedsAal2(role) && aal !== "aal2") {
    return "/logowanie/klucz";
  }
  if (role === "family") return "/rodzina";
  if (isStaffRole(role)) return "/placowka";
  return null;
}

export function pathsAreSame(left: string, right: string): boolean {
  const normalize = (path: string) =>
    path.length > 1 ? path.replace(/\/+$/, "") : path;
  return normalize(left) === normalize(right);
}
