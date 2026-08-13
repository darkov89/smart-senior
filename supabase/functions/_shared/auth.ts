export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() ?? null;
}

export function jwtAppRole(user: {
  app_metadata?: Record<string, unknown>;
}): string {
  const role = user.app_metadata?.role;
  return typeof role === "string" ? role : "";
}

export function jwtOrganizationId(user: {
  app_metadata?: Record<string, unknown>;
}): string | null {
  const organizationId = user.app_metadata?.organization_id;
  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
}
