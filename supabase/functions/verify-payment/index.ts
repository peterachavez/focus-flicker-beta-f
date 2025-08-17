// supabase/functions/verify-payment/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Plan = "starter" | "pro";

function json(body: unknown, status = 200, corsOrigin = ""): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Vary": "Origin",
    },
  });
}

serve(async (req: Request) => {
  // ---- Env (fail fast) ----
  const FRONTEND_DOMAIN = Deno.env.get("FRONTEND_DOMAIN"); // e.g. https://focus-flicker.cogello.com
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET"); // not used here, just sanity check
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const STARTER_PRICE_ID = Deno.env.get("STARTER_PRICE_ID");
  const PRO_PRICE_ID = Deno.env.get("PRO_PRICE_ID");

  const corsOrigin = FRONTEND_DOMAIN ?? "";

  if (req.method === "OPTIONS") {
    return json({ ok: true }, 204, corsOrigin);
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405, corsOrigin);
  }

  if (!FRONTEND_DOMAIN || !STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "Missing required env vars" }, 500, corsOrigin);
  }

  try {
    const { session_id, assessment_id: assessmentIdFromClient } = await req.json().catch(() => ({}));
    if (!session_id || typeof session_id !== "string") {
      return json({ ok: false, error: "Missing or invalid 'session_id'" }, 400, corsOrigin);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1) Retrieve the Checkout Session (authoritative)
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items.data.price"],
    });

    // 2) Verify payment
    if (session.payment_status !== "paid") {
      return json(
        { ok: true, verified: false, error: "Payment not marked as paid." },
        200,
        corsOrigin,
      );
    }

    // 3) Determine plan
    let plan = (session.metadata?.plan as Plan | undefined) ?? undefined;

    if (!plan) {
      // Fallback via price ID if metadata is missing
      const priceId: string | undefined =
        session.line_items?.data?.[0]?.price?.id || undefined;
      if (priceId) {
        if (STARTER_PRICE_ID && priceId === STARTER_PRICE_ID) plan = "starter";
        if (PRO_PRICE_ID && priceId === PRO_PRICE_ID) plan = "pro";
      }
    }

    if (plan !== "starter" && plan !== "pro") {
      return json(
        { ok: false, error: "Unable to determine plan (starter|pro)." },
        400,
        corsOrigin,
      );
    }

    // 4) Determine assessment_id (prefer body, then metadata)
    const resolvedAssessmentId =
      (typeof assessmentIdFromClient === "string" && assessmentIdFromClient) ||
      (session.metadata?.assessment_id as string | undefined) ||
      (session.metadata?.assessmentId as string | undefined) ||
      null;

    // 5) Append-only write to results_access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    });

    if (resolvedAssessmentId) {
      // Insert a new row. No upsert/overwrite.
      const { error: insertErr } = await supabase.from("results_access").insert({
        assessment_id: resolvedAssessmentId,
        plan,
        session_id,
      });

      // If a harmless duplicate or transient error occurs, do not fail the request.
      if (insertErr) {
        console.warn("[verify-payment] insert warning:", insertErr.message);
      }
    } else {
      console.warn("[verify-payment] missing assessment_id; skipping DB insert for session", session_id);
    }

    // 6) Respond with explicit JSON
    return json(
      {
        ok: true,
        verified: true,
        plan,
        assessment_id: resolvedAssessmentId,
      },
      200,
      corsOrigin,
    );
  } catch (err) {
    console.error("verify-payment error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message }, 200, corsOrigin);
  }
});
