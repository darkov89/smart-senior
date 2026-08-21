/**
 * Edge Function: hash-pesel
 *
 * Staff-only. Returns SHA-256+salt hash. Never persists or logs plaintext PESEL (ADR-005).
 * Env: PESEL_HASH_SALT, SUPABASE_URL, SUPABASE_ANON_KEY
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  extractBearerToken,
  jwtAppRole,
  roleFromAccessToken,
} from "../_shared/auth.ts";
import { CORS_HEADERS, jsonResponse } from "../_shared/http.ts";
import { hashPeselSha256, normalizePesel } from "../_shared/peselHash.ts";

interface HashSuccessBody {
  ok: true;
  pesel_hash: string;
}

interface HashErrorBody {
  ok: false;
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "method_not_allowed" } satisfies HashErrorBody,
      405,
    );
  }

  const salt = Deno.env.get("PESEL_HASH_SALT");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!salt || !supabaseUrl || !anonKey) {
    console.error("hash-pesel: missing env");
    return jsonResponse(
      { ok: false, error: "misconfigured" } satisfies HashErrorBody,
      500,
    );
  }

  const bearer = extractBearerToken(req.headers.get("Authorization"));
  if (!bearer) {
    return jsonResponse(
      { ok: false, error: "unauthorized" } satisfies HashErrorBody,
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
      { ok: false, error: "unauthorized" } satisfies HashErrorBody,
      401,
    );
  }

  const role =
    jwtAppRole(userData.user) || roleFromAccessToken(bearer);
  if (role !== "org_admin" && role !== "nurse" && role !== "superadmin") {
    return jsonResponse(
      { ok: false, error: "forbidden" } satisfies HashErrorBody,
      403,
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "invalid_body" } satisfies HashErrorBody,
      400,
    );
  }
  if (!isRecord(payload) || typeof payload.pesel !== "string") {
    return jsonResponse(
      { ok: false, error: "invalid_body" } satisfies HashErrorBody,
      400,
    );
  }

  const pesel = normalizePesel(payload.pesel);
  if (!pesel) {
    return jsonResponse(
      { ok: false, error: "invalid_pesel" } satisfies HashErrorBody,
      400,
    );
  }

  const peselHash = await hashPeselSha256(pesel, salt);
  return jsonResponse(
    { ok: true, pesel_hash: peselHash } satisfies HashSuccessBody,
  );
});
