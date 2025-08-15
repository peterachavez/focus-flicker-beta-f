// supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Env ---
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const FRONTEND_DOMAIN = Deno.env.get("FRONTEND_DOMAIN");
const STARTER_PRICE_ID = Deno.env.get("STARTER_PRICE_ID");
const PRO_PRICE_ID = Deno.env.get("PRO_PRICE_ID");

if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
if (!FRONTEND_DOMAIN) throw new Error("Missing FRONTEND_DOMAIN");
if (!STARTER_PRICE_ID) throw new Error("Missing STARTER_PRICE_ID");
if (!PRO_PRICE_ID) throw new Error("Missing PRO_PRICE_ID");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

type Plan = "starter" | "pro";

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const plan = (body?.plan as Plan) || undefined;
    const assessment_id = (body?.assessment_id as string | undefined) || undefined;

    if (!plan || (plan !== "starter" && plan !== "pro")) {
      return new Response(JSON.stringify({ error: "Missing or invalid 'plan' (starter|pro)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = plan === "starter" ? STARTER_PRICE_ID! : PRO_PRICE_ID!;

    const successUrl = `${FRONTEND_DOMAIN}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${FRONTEND_DOMAIN}/?checkout=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true, // promo codes enabled ✅
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{ price: priceId, quantity: 1 }],
      // optional but nice:
      customer_creation: "if_required",
      payment_method_types: ["card", "affirm"],
      invoice_creation: { enabled: true },
      metadata: {
        plan,
        ...(assessment_id ? { assessment_id } : {}),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

