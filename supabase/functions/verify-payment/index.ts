// supabase/functions/verify-payment/index.ts
// Deno Edge Function (no JWT required)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ---- Env ----
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// CORS headers for browser calls
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Parse JSON body safely
    const body = await req.json().catch(() => ({} as any));
    const session_id: string | undefined = body.session_id;

    if (!session_id) {
      return new Response(
        JSON.stringify({ verified: false, error: "missing_session_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Look up the Checkout Session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Verify payment
    const paid = session.payment_status === "paid";
    if (!paid) {
      return new Response(
        JSON.stringify({
          verified: false,
          error: "unpaid_session",
          details: `status=${session.status}, payment_status=${session.payment_status}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Normalize plan + get optional assessment_id
    const planRaw = (session.metadata?.plan || "").toLowerCase();
    const plan: "starter" | "pro" = planRaw === "pro" ? "pro" : "starter";
    const assessment_id: string | null = session.metadata?.assessment_id ?? null;

    // 3) Upsert results_access so future visits can unlock automatically
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: upsertErr } = await supabaseAdmin
      .from("results_access")
      .upsert(
        {
          session_id: session.id,
          plan,
          assessment_id, // allowed to be null
        },
        { onConflict: "session_id" },
      );

    if (upsertErr) {
      console.error("results_access upsert error:", upsertErr);
      return new Response(
        JSON.stringify({ verified: false, error: "db_upsert_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4) Done
    return new Response(
      JSON.stringify({ verified: true, plan_tier: plan }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("verify-payment fatal:", e);
    return new Response(
      JSON.stringify({
        verified: false,
        error: "verification_failed",
        details: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});