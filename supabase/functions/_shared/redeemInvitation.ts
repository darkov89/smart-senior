export const MIN_PASSWORD_LENGTH = 10;

export interface RedeemInput {
  token: string;
  password: string;
  fullName: string;
  consentFamilyPortal: boolean;
}

export function parseRedeemBody(payload: unknown): RedeemInput {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("invalid_body");
  }
  const record = payload as Record<string, unknown>;
  const token = typeof record.token === "string" ? record.token.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";
  const fullName =
    typeof record.full_name === "string" ? record.full_name.trim() : "";
  const consent =
    record.consent_family_portal === true ||
    record.consent_family_portal === "true";

  if (token.length < 16) throw new Error("invalid");
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error("weak_password");
  if (fullName.length === 0) throw new Error("invalid_body");
  if (!consent) throw new Error("consent_required");

  return {
    token,
    password,
    fullName,
    consentFamilyPortal: true,
  };
}
