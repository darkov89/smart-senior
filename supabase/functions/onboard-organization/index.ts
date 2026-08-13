/**
 * Edge Function: onboard-organization
 *
 * Superadmin-only B2B onboarding: create organization, invite org_admin,
 * attach profile (organization_id + role). ADR-006.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 * verify_jwt = true — caller must be authenticated superadmin.
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";

interface OnboardBody {
  org_name: string;
  admin_email: string;
}

interface OnboardSuccessBody {
  ok: true;
  organization_id: string;
  admin_user_id: string;
  invited_email: string;
}

interface OnboardErrorBody {
  ok: false;
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(payload: unknown): OnboardBody {
  if (!isRecord(payload)) {
    throw new Error("Body must be a JSON object");
  }
  const orgName = payload.org_name;
  const adminEmail = payload.admin_email;
  if (typeof orgName !== "string" || orgName.trim().length === 0) {
    throw new Error("org_name is required");
  }
  if (typeof adminEmail !== "string" || !adminEmail.includes("@")) {
    throw new Error("admin_email is required");
  }
  return {
    org_name: orgName.trim(),
    admin_email: adminEmail.trim().toLowerCase(),
  };
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() ?? null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" } satisfies OnboardErrorBody,
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("onboard-organization: missing env secrets");
      return jsonResponse(
        { ok: false, error: "Server misconfigured" } satisfies OnboardErrorBody,
        500,
      );
    }

    const bearer = extractBearerToken(req.headers.get("Authorization"));
    if (!bearer) {
      return jsonResponse(
        { ok: false, error: "Unauthorized" } satisfies OnboardErrorBody,
        401,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(
      bearer,
    );
    if (userError || !userData.user) {
      return jsonResponse(
        { ok: false, error: "Unauthorized" } satisfies OnboardErrorBody,
        401,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("onboard-organization: profile lookup", profileError.message);
      return jsonResponse(
        { ok: false, error: "Failed to authorize caller" } satisfies OnboardErrorBody,
        500,
      );
    }

    const callerRole =
      typeof callerProfile?.role === "string" ? callerProfile.role : "";
    if (callerRole !== "superadmin") {
      return jsonResponse(
        { ok: false, error: "Forbidden" } satisfies OnboardErrorBody,
        403,
      );
    }

    let body: OnboardBody;
    try {
      body = parseBody(await req.json());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON body";
      return jsonResponse(
        { ok: false, error: message } satisfies OnboardErrorBody,
        400,
      );
    }

    const { data: organization, error: orgError } = await admin
      .from("organizations")
      .insert({ name: body.org_name })
      .select("id")
      .single();

    if (orgError || !organization) {
      console.error("onboard-organization: org insert", orgError?.message);
      return jsonResponse(
        { ok: false, error: "Failed to create organization" } satisfies OnboardErrorBody,
        500,
      );
    }

    const organizationId = organization.id as string;

    const { data: invited, error: inviteError } = await admin.auth.admin
      .inviteUserByEmail(body.admin_email);

    if (inviteError || !invited.user) {
      await admin.from("organizations").delete().eq("id", organizationId);
      console.error(
        "onboard-organization: invite",
        inviteError?.message ?? "no user",
      );
      return jsonResponse(
        {
          ok: false,
          error: inviteError?.message ?? "Failed to invite administrator",
        } satisfies OnboardErrorBody,
        400,
      );
    }

    const adminUserId = invited.user.id;

    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: adminUserId,
        organization_id: organizationId,
        role: "org_admin",
        full_name: "",
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      console.error("onboard-organization: profile upsert", upsertError.message);
      return jsonResponse(
        {
          ok: false,
          error: "Organization created but profile assignment failed",
        } satisfies OnboardErrorBody,
        500,
      );
    }

    return jsonResponse(
      {
        ok: true,
        organization_id: organizationId,
        admin_user_id: adminUserId,
        invited_email: body.admin_email,
      } satisfies OnboardSuccessBody,
      200,
    );
  } catch (err) {
    console.error(
      "onboard-organization: unhandled",
      err instanceof Error ? err.message : err,
    );
    return jsonResponse(
      { ok: false, error: "Internal server error" } satisfies OnboardErrorBody,
      500,
    );
  }
});
