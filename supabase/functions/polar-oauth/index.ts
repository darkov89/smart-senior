/**
 * Edge Function: polar-oauth
 *
 * AccessLink OAuth2 (authorization code). Staff JWT on start;
 * Polar callback uses signed `state` (no end-user JWT).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 *      POLAR_CLIENT_ID, POLAR_CLIENT_SECRET, POLAR_REDIRECT_URI,
 *      POLAR_OAUTH_STATE_SECRET, POLAR_OAUTH_SUCCESS_URL (optional)
 *
 * verify_jwt = false — callback comes from Polar without a Bearer token.
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  extractBearerToken,
  jwtAppRole,
  jwtOrganizationId,
} from "../_shared/auth.ts";
import { hmacSha256Hex, timingSafeEqualHex } from "../_shared/polarHmac.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";

interface OauthErrorBody {
  ok: false;
  error: string;
}

interface OauthStartBody {
  ok: true;
  authorize_url: string;
}

interface SignedOauthState {
  patientId: string;
  organizationId: string;
  exp: number;
}

const POLAR_AUTHORIZE_URL = "https://flow.polar.com/oauth2/authorization";
const POLAR_TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
const STATE_TTL_SECONDS = 10 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function encodeStatePayload(state: SignedOauthState): string {
  return btoa(JSON.stringify(state));
}

function decodeStatePayload(encoded: string): SignedOauthState | null {
  try {
    const parsed: unknown = JSON.parse(atob(encoded));
    if (!isRecord(parsed)) {
      return null;
    }
    const patientId = parsed.patientId;
    const organizationId = parsed.organizationId;
    const exp = parsed.exp;
    if (
      typeof patientId !== "string" ||
      typeof organizationId !== "string" ||
      typeof exp !== "number"
    ) {
      return null;
    }
    return { patientId, organizationId, exp };
  } catch {
    return null;
  }
}

async function signState(
  state: SignedOauthState,
  secret: string,
): Promise<string> {
  const payload = encodeStatePayload(state);
  const mac = await hmacSha256Hex(secret, payload);
  return `${payload}.${mac}`;
}

async function verifyState(
  raw: string,
  secret: string,
): Promise<SignedOauthState | null> {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  const expected = await hmacSha256Hex(secret, payload);
  if (!timingSafeEqualHex(expected, mac)) {
    return null;
  }
  const state = decodeStatePayload(payload);
  if (state === null || state.exp < Date.now() / 1000) {
    return null;
  }
  return state;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const token = btoa(`${clientId}:${clientSecret}`);
  return `Basic ${token}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" } satisfies OauthErrorBody,
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const polarClientId = requiredEnv("POLAR_CLIENT_ID");
  const polarClientSecret = requiredEnv("POLAR_CLIENT_SECRET");
  const polarRedirectUri = requiredEnv("POLAR_REDIRECT_URI");
  const stateSecret = requiredEnv("POLAR_OAUTH_STATE_SECRET");

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !anonKey ||
    !polarClientId ||
    !polarClientSecret ||
    !polarRedirectUri ||
    !stateSecret
  ) {
    console.error("polar-oauth: missing env secrets");
    return jsonResponse(
      { ok: false, error: "Server misconfigured" } satisfies OauthErrorBody,
      500,
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const patientId = url.searchParams.get("patient_id");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (code && stateParam) {
      const state = await verifyState(stateParam, stateSecret);
      if (state === null) {
        return jsonResponse(
          { ok: false, error: "Invalid or expired state" } satisfies OauthErrorBody,
          400,
        );
      }

      const tokenResponse = await fetch(POLAR_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: basicAuthHeader(polarClientId, polarClientSecret),
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json;charset=UTF-8",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: polarRedirectUri,
        }),
      });

      const tokenJson: unknown = await tokenResponse.json();
      if (!tokenResponse.ok || !isRecord(tokenJson)) {
        console.error("polar-oauth: token exchange failed", tokenResponse.status);
        return jsonResponse(
          { ok: false, error: "Polar token exchange failed" } satisfies OauthErrorBody,
          502,
        );
      }

      const accessToken = tokenJson.access_token;
      const polarUserId = tokenJson.x_user_id;
      const expiresIn = tokenJson.expires_in;
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        return jsonResponse(
          { ok: false, error: "Polar token missing" } satisfies OauthErrorBody,
          502,
        );
      }

      const polarUserIdText =
        typeof polarUserId === "number" || typeof polarUserId === "string"
          ? String(polarUserId)
          : "";

      const { data: existing } = await admin
        .from("polar_connections")
        .select("id")
        .eq("patient_id", state.patientId)
        .is("revoked_at", null)
        .maybeSingle();

      let connectionId: string;
      if (existing?.id) {
        const { error: updateError } = await admin
          .from("polar_connections")
          .update({
            polar_user_id: polarUserIdText,
            linked_at: new Date().toISOString(),
            organization_id: state.organizationId,
          })
          .eq("id", existing.id);
        if (updateError) {
          console.error("polar-oauth: connection update", updateError.message);
          return jsonResponse(
            { ok: false, error: "Failed to link Polar account" } satisfies OauthErrorBody,
            500,
          );
        }
        connectionId = existing.id as string;
      } else {
        const { data: inserted, error: insertError } = await admin
          .from("polar_connections")
          .insert({
            organization_id: state.organizationId,
            patient_id: state.patientId,
            polar_user_id: polarUserIdText,
            linked_at: new Date().toISOString(),
            revoked_at: null,
          })
          .select("id")
          .single();
        if (insertError || !inserted) {
          console.error("polar-oauth: connection insert", insertError?.message);
          return jsonResponse(
            { ok: false, error: "Failed to link Polar account" } satisfies OauthErrorBody,
            500,
          );
        }
        connectionId = inserted.id as string;
      }

      const expiresAt =
        typeof expiresIn === "number"
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : null;

      const { error: secretError } = await admin.from("polar_oauth_secrets").upsert(
        {
          polar_connection_id: connectionId,
          access_token: accessToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "polar_connection_id" },
      );

      if (secretError) {
        console.error("polar-oauth: secret upsert", secretError.message);
        return jsonResponse(
          { ok: false, error: "Failed to store Polar credentials" } satisfies OauthErrorBody,
          500,
        );
      }

      const successUrl = requiredEnv("POLAR_OAUTH_SUCCESS_URL");
      if (successUrl) {
        return Response.redirect(successUrl, 302);
      }

      return jsonResponse({ ok: true, patient_id: state.patientId }, 200);
    }

    if (!patientId) {
      return jsonResponse(
        { ok: false, error: "patient_id is required" } satisfies OauthErrorBody,
        400,
      );
    }

    const bearer = extractBearerToken(req.headers.get("Authorization"));
    if (!bearer) {
      return jsonResponse(
        { ok: false, error: "Unauthorized" } satisfies OauthErrorBody,
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
        { ok: false, error: "Unauthorized" } satisfies OauthErrorBody,
        401,
      );
    }

    const role = jwtAppRole(userData.user);
    const organizationId = jwtOrganizationId(userData.user);
    if (
      (role !== "org_admin" && role !== "nurse") ||
      organizationId === null
    ) {
      return jsonResponse(
        { ok: false, error: "Forbidden" } satisfies OauthErrorBody,
        403,
      );
    }

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .select("id, organization_id")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return jsonResponse(
        { ok: false, error: "Patient not found" } satisfies OauthErrorBody,
        404,
      );
    }

    if (patient.organization_id !== organizationId) {
      return jsonResponse(
        { ok: false, error: "Forbidden" } satisfies OauthErrorBody,
        403,
      );
    }

    const signed = await signState(
      {
        patientId,
        organizationId,
        exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
      },
      stateSecret,
    );

    const authorizeUrl = new URL(POLAR_AUTHORIZE_URL);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", polarClientId);
    authorizeUrl.searchParams.set("redirect_uri", polarRedirectUri);
    authorizeUrl.searchParams.set("scope", "accesslink.read_all");
    authorizeUrl.searchParams.set("state", signed);

    return jsonResponse(
      { ok: true, authorize_url: authorizeUrl.toString() } satisfies OauthStartBody,
      200,
    );
  } catch (err) {
    console.error(
      "polar-oauth: unhandled",
      err instanceof Error ? err.message : err,
    );
    return jsonResponse(
      { ok: false, error: "Internal server error" } satisfies OauthErrorBody,
      500,
    );
  }
});
