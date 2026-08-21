/**
 * Edge Function: onboard-organization
 *
 * Superadmin-only B2B onboarding: create organization, invite org_admin,
 * attach profile + Auth app_metadata (ADR-006 / TASK-INFRA-02).
 *
 * Called by the Super Admin app — not a Database Webhook (service_role INSERT
 * would recurse; admin email is not an organizations column).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SITE_URL?
 * SITE_URL optional — loopback/missing falls back to https://smart-senior.pages.dev/logowanie.
 * verify_jwt = true — caller must be authenticated superadmin.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  extractBearerToken,
  jwtAppRole,
  roleFromAccessToken,
} from "../_shared/auth.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import {
  inviteRedirectUrl,
  isSuperadminRole,
  orgAdminAppMetadata,
  parseOnboardBody,
  type OnboardInput,
} from "../_shared/onboardOrganization.ts";

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

async function rollbackOnboarding(
  admin: SupabaseClient,
  organizationId: string | null,
  createdUserId: string | null,
): Promise<void> {
  if (createdUserId) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(
      createdUserId,
    );
    if (deleteUserError) {
      console.error(
        "onboard-organization: rollback user",
        deleteUserError.message,
      );
    }
  }
  if (organizationId) {
    const { error: deleteOrgError } = await admin
      .from("organizations")
      .delete()
      .eq("id", organizationId);
    if (deleteOrgError) {
      console.error(
        "onboard-organization: rollback org",
        deleteOrgError.message,
      );
    }
  }
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

    const callerRole =
      jwtAppRole(userData.user) || roleFromAccessToken(bearer);
    if (!isSuperadminRole(callerRole)) {
      return jsonResponse(
        { ok: false, error: "Forbidden" } satisfies OnboardErrorBody,
        403,
      );
    }

    let body: OnboardInput;
    try {
      body = parseOnboardBody(await req.json());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON body";
      return jsonResponse(
        { ok: false, error: message } satisfies OnboardErrorBody,
        400,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: organization, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: body.orgName,
        address: body.address,
        resident_limit: body.residentLimit,
      })
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
    const redirectTo = inviteRedirectUrl(Deno.env.get("SITE_URL"));

    const { data: invited, error: inviteError } = await admin.auth.admin
      .inviteUserByEmail(body.adminEmail, {
        data: {
          full_name: body.adminFullName,
          organization_name: body.orgName,
        },
        redirectTo,
      });

    if (inviteError || !invited.user) {
      await rollbackOnboarding(admin, organizationId, null);
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
    const appMetadata = orgAdminAppMetadata(organizationId);

    const { error: metadataError } = await admin.auth.admin.updateUserById(
      adminUserId,
      { app_metadata: appMetadata },
    );
    if (metadataError) {
      await rollbackOnboarding(admin, organizationId, adminUserId);
      console.error(
        "onboard-organization: app_metadata",
        metadataError.message,
      );
      return jsonResponse(
        { ok: false, error: "Failed to assign administrator role" } satisfies OnboardErrorBody,
        500,
      );
    }

    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: adminUserId,
        organization_id: organizationId,
        role: "org_admin",
        full_name: body.adminFullName,
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      await rollbackOnboarding(admin, organizationId, adminUserId);
      console.error("onboard-organization: profile upsert", upsertError.message);
      return jsonResponse(
        {
          ok: false,
          error: "Failed to assign administrator profile",
        } satisfies OnboardErrorBody,
        500,
      );
    }

    return jsonResponse(
      {
        ok: true,
        organization_id: organizationId,
        admin_user_id: adminUserId,
        invited_email: body.adminEmail,
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
