// supabase/functions/create-checkout-session/index.ts
// Creates a Stripe Checkout Session.
// - CORS works for your production origin and localhost
// - Promo code box enabled (allow_promotion_codes: true)
// - success_url EXACTLY `${FRONTEND_DOMAIN}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`
// - JWT required (verify_jwt = true in config.toml)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@14.25.0";

// ---------- ENV ----------
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STARTER_PRICE_ID = Deno.env.get("STARTER_PRICE_ID") ?? "";
const PRO_PRICE_ID = Deno.env.get("PRO_PRICE_ID") ?? "";
const RAW_FRONTEND_DOMAIN = Deno.env.get("FRONTEND_DOMAIN") ?? "";

// Normalize origin (no trailing slash)
const FRONTEND_DOMAIN = RAW_FRONTEND_DOMAIN.replace(/\/+$/, "");

if (!STRIPE_SECRET_KEY || !FRONTEND_DOMAIN) {
  console.error("Missing env: STRIPE_SECRET_KEY or FRONTEND_DOMAIN");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// ---------- CORS ----------
const ALLOWED_ORIGINS = new Set([
  FRONTEND_DOMAIN,
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : FRONTEND_DOMAIN || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(body: unknown, init: ResponseInit = {}, req?: Request) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  const ch = corsHeadersFor(req!);
  for (const [k, v] of Object.entries(ch)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

// ---------- SERVER ----------
serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(req) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 }, req);
  }

  try {
    const { plan, assessment_id } = await req.json().catch(() => ({}));

    if (!plan || (plan !== "starter" && plan !== "pro")) {
      return json({ error: "Invalid plan" }, { status: 400 }, req);
    }

    const price = plan === "pro" ? PRO_PRICE_ID : STARTER_PRICE_ID;
    if (!price) {
      return json(
        { error: `Missing price id for plan: ${plan}` },
        { status: 500 },
        req,
      );
    }

    const successUrl =
      `${FRONTEND_DOMAIN}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${FRONTEND_DOMAIN}`;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true, // <-- promo code box
      success_url: successUrl, // <-- keep exact format
      cancel_url: cancelUrl,
      // Pass useful metadata (do not depend on it in the client)
      metadata: {
        plan,
        ...(assessment_id ? { assessment_id } : {}),
      },
    });

    return json({ url: session.url }, { status: 200 }, req);
  } catch (err) {
    console.error("[create-checkout-session] Error:", err);
    return json(
      { error: "Failed to create checkout session" },
      { status: 500 },
      req,
    );
  }
});
