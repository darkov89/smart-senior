/**
 * Edge Function: redeem-family-invitation
 *
 * Public token → family auth user + family_connections. Family has no SELECT on invitations.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import { parseRedeemBody } from "../_shared/redeemInvitation.ts";

interface RedeemSuccessBody {
  ok: true;
  email: string;
}

interface RedeemErrorBody {
  ok: false;
  error: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "method_not_allowed" } satisfies RedeemErrorBody,
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("redeem-family-invitation: missing env");
    return jsonResponse(
      { ok: false, error: "misconfigured" } satisfies RedeemErrorBody,
      500,
    );
  }

  let body: ReturnType<typeof parseRedeemBody>;
  try {
    body = parseRedeemBody(await req.json());
  } catch (err) {
    const code = err instanceof Error ? err.message : "invalid_body";
    return jsonResponse(
      { ok: false, error: code } satisfies RedeemErrorBody,
      400,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: invitation, error: inviteError } = await admin
    .from("family_invitations")
    .select(
      "id, email, organization_id, patient_id, relationship, status, expires_at",
    )
    .eq("invite_token", body.token)
    .maybeSingle();

  if (inviteError || !invitation) {
    return jsonResponse(
      { ok: false, error: "invalid" } satisfies RedeemErrorBody,
      400,
    );
  }

  if (invitation.status === "revoked") {
    return jsonResponse(
      { ok: false, error: "revoked" } satisfies RedeemErrorBody,
      400,
    );
  }

  const expired =
    invitation.status === "expired" ||
    new Date(invitation.expires_at as string).getTime() < Date.now();
  if (expired) {
    if (invitation.status === "pending") {
      await admin
        .from("family_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
    }
    return jsonResponse(
      { ok: false, error: "expired" } satisfies RedeemErrorBody,
      400,
    );
  }

  if (invitation.status !== "pending") {
    return jsonResponse(
      { ok: false, error: "invalid" } satisfies RedeemErrorBody,
      400,
    );
  }

  const email = invitation.email as string;
  const organizationId = invitation.organization_id as string;
  const patientId = invitation.patient_id as string;

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existingSession } = await anon.auth.signInWithPassword({
    email,
    password: body.password,
  });

  let userId = existingSession.user?.id ?? null;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin
      .createUser({
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: {
          role: "family",
          organization_id: organizationId,
        },
        user_metadata: { full_name: body.fullName },
      });
    if (createError || !created.user) {
      console.error(
        "redeem-family-invitation: createUser",
        createError?.message,
      );
      return jsonResponse(
        { ok: false, error: "existing_account" } satisfies RedeemErrorBody,
        400,
      );
    }
    userId = created.user.id;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (
    profile &&
    profile.role !== "family" &&
    typeof profile.role === "string"
  ) {
    return jsonResponse(
      { ok: false, error: "invalid" } satisfies RedeemErrorBody,
      400,
    );
  }
  if (
    profile?.organization_id &&
    profile.organization_id !== organizationId
  ) {
    return jsonResponse(
      { ok: false, error: "invalid" } satisfies RedeemErrorBody,
      400,
    );
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      organization_id: organizationId,
      role: "family",
      full_name: body.fullName,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    console.error("redeem-family-invitation: profile", profileError.message);
    return jsonResponse(
      { ok: false, error: "failed" } satisfies RedeemErrorBody,
      500,
    );
  }

  const { data: existingConnection } = await admin
    .from("family_connections")
    .select("id, status")
    .eq("profile_id", userId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (existingConnection) {
    const { error: reactivateError } = await admin
      .from("family_connections")
      .update({
        status: "active",
        revoked_at: null,
        relationship: invitation.relationship,
      })
      .eq("id", existingConnection.id);
    if (reactivateError) {
      console.error(
        "redeem-family-invitation: reconnect",
        reactivateError.message,
      );
      return jsonResponse(
        { ok: false, error: "failed" } satisfies RedeemErrorBody,
        500,
      );
    }
  } else {
    const { error: connectionError } = await admin.from("family_connections")
      .insert({
        organization_id: organizationId,
        patient_id: patientId,
        profile_id: userId,
        relationship: invitation.relationship,
        status: "active",
      });
    if (connectionError) {
      console.error(
        "redeem-family-invitation: connection",
        connectionError.message,
      );
      return jsonResponse(
        { ok: false, error: "failed" } satisfies RedeemErrorBody,
        500,
      );
    }
  }

  const { error: consentError } = await admin.from("consent_ledger").insert({
    organization_id: organizationId,
    patient_id: patientId,
    profile_id: userId,
    purpose: "family_portal_access",
    consent_version: "2026-08-21",
    source: "invitation_redeem",
    granted_by: userId,
  });
  if (consentError) {
    console.error("redeem-family-invitation: consent", consentError.message);
  }

  const { error: acceptError } = await admin
    .from("family_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id);
  if (acceptError) {
    console.error("redeem-family-invitation: accept", acceptError.message);
    return jsonResponse(
      { ok: false, error: "failed" } satisfies RedeemErrorBody,
      500,
    );
  }

  return jsonResponse(
    { ok: true, email } satisfies RedeemSuccessBody,
  );
});
