/**
 * Edge Function: polar-webhook
 *
 * Polar AccessLink webhook (POST). HMAC header Polar-Webhook-Signature.
 * Writes polar_* via service_role (bypasses RLS).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POLAR_WEBHOOK_SECRET
 * verify_jwt = false
 *
 * Polar pings (PING / ACTIVITY_SUMMARY / SLEEP / …) notify that data is ready.
 * Optional partner payload with daily aggregates is also accepted after HMAC.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { isRecord } from "../_shared/auth.ts";
import { jsonResponse } from "../_shared/http.ts";
import { verifyPolarWebhookSignature } from "../_shared/polarHmac.ts";

interface WebhookOkBody {
  ok: true;
  event: string;
}

interface WebhookErrorBody {
  ok: false;
  error: string;
}

interface DailyActivityRow {
  organization_id: string;
  patient_id: string;
  local_date: string;
  steps: number;
  active_duration_seconds: number;
  calories: number;
}

interface SleepNightRow {
  organization_id: string;
  patient_id: string;
  local_date: string;
  duration_seconds: number;
  sleep_score: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
}

interface HeartRateDailyRow {
  organization_id: string;
  patient_id: string;
  local_date: string;
  bpm_avg: number | null;
  bpm_min: number | null;
  bpm_max: number | null;
}

interface HrvNightRow {
  organization_id: string;
  patient_id: string;
  local_date: string;
  rmssd_ms: number | null;
}

function asNonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

function asOptionalNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

function asOptionalNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function upsertNormalizedAggregates(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const patientId = payload.patient_id;
  const organizationId = payload.organization_id;
  const localDate = payload.local_date;
  if (
    typeof patientId !== "string" ||
    typeof organizationId !== "string" ||
    typeof localDate !== "string" ||
    !isIsoDate(localDate)
  ) {
    return false;
  }

  const activity = isRecord(payload.activity) ? payload.activity : null;
  const sleep = isRecord(payload.sleep) ? payload.sleep : null;
  const heartRate = isRecord(payload.heart_rate) ? payload.heart_rate : null;
  const hrv = isRecord(payload.hrv) ? payload.hrv : null;

  if (activity) {
    const row: DailyActivityRow = {
      organization_id: organizationId,
      patient_id: patientId,
      local_date: localDate,
      steps: asNonNegativeInt(activity.steps),
      active_duration_seconds: asNonNegativeInt(activity.active_duration_seconds),
      calories: asNonNegativeInt(activity.calories),
    };
    const { error } = await admin.from("polar_daily_activity").upsert(row, {
      onConflict: "patient_id,local_date",
    });
    if (error) {
      console.error("polar-webhook: activity upsert", error.message);
      throw new Error("activity upsert failed");
    }
  }

  if (sleep) {
    const row: SleepNightRow = {
      organization_id: organizationId,
      patient_id: patientId,
      local_date: localDate,
      duration_seconds: asNonNegativeInt(sleep.duration_seconds),
      sleep_score: asOptionalNonNegativeInt(sleep.sleep_score),
      sleep_start: typeof sleep.sleep_start === "string" ? sleep.sleep_start : null,
      sleep_end: typeof sleep.sleep_end === "string" ? sleep.sleep_end : null,
    };
    const { error } = await admin.from("polar_sleep_nights").upsert(row, {
      onConflict: "patient_id,local_date",
    });
    if (error) {
      console.error("polar-webhook: sleep upsert", error.message);
      throw new Error("sleep upsert failed");
    }
  }

  if (heartRate) {
    const row: HeartRateDailyRow = {
      organization_id: organizationId,
      patient_id: patientId,
      local_date: localDate,
      bpm_avg: asOptionalNonNegativeInt(heartRate.bpm_avg),
      bpm_min: asOptionalNonNegativeInt(heartRate.bpm_min),
      bpm_max: asOptionalNonNegativeInt(heartRate.bpm_max),
    };
    const { error } = await admin.from("polar_heart_rate_daily").upsert(row, {
      onConflict: "patient_id,local_date",
    });
    if (error) {
      console.error("polar-webhook: hr upsert", error.message);
      throw new Error("heart rate upsert failed");
    }
  }

  if (hrv) {
    const row: HrvNightRow = {
      organization_id: organizationId,
      patient_id: patientId,
      local_date: localDate,
      rmssd_ms: asOptionalNonNegativeNumber(hrv.rmssd_ms),
    };
    const { error } = await admin.from("polar_hrv_nights").upsert(row, {
      onConflict: "patient_id,local_date",
    });
    if (error) {
      console.error("polar-webhook: hrv upsert", error.message);
      throw new Error("hrv upsert failed");
    }
  }

  return activity !== null || sleep !== null || heartRate !== null || hrv !== null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true, event: "OPTIONS" } satisfies WebhookOkBody, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" } satisfies WebhookErrorBody,
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("POLAR_WEBHOOK_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error("polar-webhook: missing env secrets");
    return jsonResponse(
      { ok: false, error: "Server misconfigured" } satisfies WebhookErrorBody,
      500,
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("Polar-Webhook-Signature");
  const valid = await verifyPolarWebhookSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    return jsonResponse(
      { ok: false, error: "Invalid signature" } satisfies WebhookErrorBody,
      401,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      { ok: false, error: "Invalid JSON" } satisfies WebhookErrorBody,
      400,
    );
  }

  if (!isRecord(parsed)) {
    return jsonResponse(
      { ok: false, error: "Body must be a JSON object" } satisfies WebhookErrorBody,
      400,
    );
  }

  const headerEvent = req.headers.get("Polar-Webhook-Event");
  const eventName =
    typeof parsed.event === "string"
      ? parsed.event
      : headerEvent ?? "UNKNOWN";

  if (eventName === "PING") {
    return jsonResponse({ ok: true, event: "PING" } satisfies WebhookOkBody, 200);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const wroteNormalized = await upsertNormalizedAggregates(admin, parsed);
    if (wroteNormalized) {
      return jsonResponse(
        { ok: true, event: eventName } satisfies WebhookOkBody,
        200,
      );
    }

    const polarUserId =
      typeof parsed.user_id === "number" || typeof parsed.user_id === "string"
        ? String(parsed.user_id)
        : "";

    if (polarUserId.length === 0) {
      return jsonResponse({ ok: true, event: eventName } satisfies WebhookOkBody, 200);
    }

    const { data: connection, error: lookupError } = await admin
      .from("polar_connections")
      .select("id, patient_id, organization_id")
      .eq("polar_user_id", polarUserId)
      .is("revoked_at", null)
      .maybeSingle();

    if (lookupError) {
      console.error("polar-webhook: connection lookup", lookupError.message);
      return jsonResponse(
        { ok: false, error: "Lookup failed" } satisfies WebhookErrorBody,
        500,
      );
    }

    if (!connection) {
      console.error("polar-webhook: no connection for polar_user_id");
      return jsonResponse({ ok: true, event: eventName } satisfies WebhookOkBody, 200);
    }

    // AccessLink sends a ping + resource URL; pull-and-normalize lands in a later increment.
    console.log(
      JSON.stringify({
        msg: "polar-webhook: ping accepted, fetch-normalize deferred",
        event: eventName,
        patient_id: connection.patient_id,
      }),
    );

    return jsonResponse({ ok: true, event: eventName } satisfies WebhookOkBody, 200);
  } catch (err) {
    console.error(
      "polar-webhook: unhandled",
      err instanceof Error ? err.message : err,
    );
    return jsonResponse(
      { ok: false, error: "Internal server error" } satisfies WebhookErrorBody,
      500,
    );
  }
});
