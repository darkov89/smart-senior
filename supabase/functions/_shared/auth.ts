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

export function roleFromAccessToken(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  if (!payload) return "";
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const claims = JSON.parse(atob(padded)) as {
      app_metadata?: Record<string, unknown>;
    };
    const role = claims.app_metadata?.role;
    return typeof role === "string" ? role : "";
  } catch {
    return "";
  }
}

export function jwtOrganizationId(user: {
  app_metadata?: Record<string, unknown>;
}): string | null {
  const organizationId = user.app_metadata?.organization_id;
  return typeof organizationId === "string" && organizationId.length > 0
    ? organizationId
    : null;
}
