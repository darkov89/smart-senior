export const ORG_NAME_MAX_LENGTH = 200;
export const ADDRESS_MAX_LENGTH = 500;
export const RESIDENT_LIMIT_MIN = 1;
export const RESIDENT_LIMIT_MAX = 10000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface OnboardInput {
  orgName: string;
  adminEmail: string;
  adminFullName: string;
  address: string | null;
  residentLimit: number | null;
}

export interface OrgAdminAppMetadata {
  role: "org_admin";
  organization_id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalTrimmedString(
  value: unknown,
  maxLength: number,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} is too long`);
  }
  return trimmed;
}

function optionalResidentLimit(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error("resident_limit must be an integer");
  }
  if (parsed < RESIDENT_LIMIT_MIN || parsed > RESIDENT_LIMIT_MAX) {
    throw new Error("resident_limit is out of range");
  }
  return parsed;
}

export function parseOnboardBody(payload: unknown): OnboardInput {
  if (!isRecord(payload)) {
    throw new Error("Body must be a JSON object");
  }

  const orgName = optionalTrimmedString(
    payload.org_name,
    ORG_NAME_MAX_LENGTH,
    "org_name",
  );
  if (!orgName) {
    throw new Error("org_name is required");
  }

  if (typeof payload.admin_email !== "string") {
    throw new Error("admin_email is required");
  }
  const adminEmail = payload.admin_email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(adminEmail)) {
    throw new Error("admin_email is required");
  }

  const adminFullName =
    optionalTrimmedString(
      payload.admin_full_name,
      ORG_NAME_MAX_LENGTH,
      "admin_full_name",
    ) ?? "";

  return {
    orgName,
    adminEmail,
    adminFullName,
    address: optionalTrimmedString(payload.address, ADDRESS_MAX_LENGTH, "address"),
    residentLimit: optionalResidentLimit(payload.resident_limit),
  };
}

export const PUBLIC_APP_URL = "https://smart-senior.pages.dev";

export function isSuperadminRole(role: string): boolean {
  return role === "superadmin";
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export function inviteRedirectUrl(siteUrl: string | undefined): string {
  const fallback = `${PUBLIC_APP_URL}/logowanie`;
  const trimmed = (siteUrl ?? "").trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (isLoopbackHost(parsed.hostname)) return fallback;
  } catch {
    return fallback;
  }
  return `${trimmed}/logowanie`;
}

export function orgAdminAppMetadata(organizationId: string): OrgAdminAppMetadata {
  return {
    role: "org_admin",
    organization_id: organizationId,
  };
}
