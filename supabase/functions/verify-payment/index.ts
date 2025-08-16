// supabase/functions/verify-payment/index.ts
// Deploy with: supabase functions deploy verify-payment --no-verify-jwt

import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2";

type Json = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

// ---- Read required env ----
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Optional mapping for price → tier (nice safety net if metadata is missing)
const STARTER_PRICE_ID = Deno.env.get("STARTER_PRICE_ID")?.trim();
const PRO_PRICE_ID = Deno.env.get("PRO_PRICE_ID")?.trim();

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function mapPriceToTier(priceId?: string | null): "starter" | "pro" | "" {
  if (!priceId) return "";
  if (STARTER_PRICE_ID && priceId === STARTER_PRICE_ID) return "starter";
  if (PRO_PRICE_ID && priceId === PRO_PRICE_ID) return "pro";
  // If you only sell two tiers and PRO is the default, you could:
  // return "pro";
  return "";
}

Deno.serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    // Ensure required envs exist
    if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing required env(s).");
      return json({ verified: false, error: "server_misconfigured" }, 500);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Parse incoming body
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json({ verified: false, error: "invalid_json" }, 400);
    }
    const session_id: string = payload?.session_id;
    if (!session_id || typeof session_id !== "string") {
      return json({ verified: false, error: "missing_session_id" }, 400);
    }

    // Retrieve the Checkout Session
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent", "line_items.data.price", "subscription"],
    });

    if (!session) {
      return json({ verified: false, error: "session_not_found" }, 404);
    }

    // Accept both payment_status=paid and status=complete
    const isPaid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      // For some setups, mode=subscription and a paid invoice also indicates success:
      (session.mode === "subscription" && session.subscription);

    if (!isPaid) {
      return json(
        {
          verified: false,
          error: "not_paid",
          details: {
            status: session.status,
            payment_status: session.payment_status,
          },
        },
        400
      );
    }

    // Pull identifiers from metadata first (recommended)
    let assessment_id =
      (session.metadata?.assessment_id as string | undefined)?.trim() ?? "";
    let plan_tier =
      ((session.metadata?.plan_tier ||
        session.metadata?.tier ||
        session.metadata?.plan) as string | undefined)?.trim() ?? "";

    // Fallback: infer plan from the first line item price if missing
    if (!plan_tier) {
      // line_items might already be expanded via expand above, but not guaranteed
      let priceId: string | undefined;

      if ((session as any).line_items?.data?.length) {
        priceId = (session as any).line_items.data[0]?.price?.id as string | undefined;
      } else {
        // fetch if not already expanded
        const items = await stripe.checkout.sessions.listLineItems(session_id, { limit: 1 });
        priceId = items.data[0]?.price?.id;
      }

      plan_tier = mapPriceToTier(priceId);
    }

    // If still missing assessment_id, attempt to parse from success_url query (optional)
    // This is a fallback only—prefer metadata in the create-checkout-session function.
    if (!assessment_id) {
      try {
        const url = new URL(session.success_url ?? "");
        const maybeId = url.searchParams.get("assessment_id") ?? url.searchParams.get("a");
        if (maybeId) assessment_id = maybeId;
      } catch {
        // ignore parsing failure
      }
    }

    // Validate we can write access
    if (!assessment_id) {
      return json({ verified: false, error: "missing_assessment_id" }, 400);
    }
    if (!plan_tier || (plan_tier !== "starter" && plan_tier !== "pro")) {
      return json({ verified: false, error: "invalid_or_missing_plan_tier" }, 400);
    }

    // UPSERT into public.results_access
    // Columns assumed: assessment_id (unique), plan, session_id, created_at
    const { error: upsertErr } = await supabase
      .from("results_access")
      .upsert(
        { assessment_id, plan: plan_tier, session_id },
        { onConflict: "assessment_id", ignoreDuplicates: false }
      );

    if (upsertErr) {
      console.error("results_access upsert error:", upsertErr);
      return json({ verified: false, error: "db_upsert_failed" }, 500);
    }

    // Success
    return json({
      verified: true,
      assessment_id,
      plan_tier,
      session_id,
    });
  } catch (err) {
    console.error("verify-payment fatal error:", err);
    return json({ verified: false, error: "unexpected_error" }, 500);
  }
});
