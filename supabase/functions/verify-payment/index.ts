import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@14.25.0";

// ---------- ENV ----------
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STARTER_PRICE_ID = Deno.env.get("STARTER_PRICE_ID") ?? "";
const PRO_PRICE_ID = Deno.env.get("PRO_PRICE_ID") ?? "";
const RAW_FRONTEND_DOMAIN = Deno.env.get("FRONTEND_DOMAIN") ?? "";

// Normalize origin (no trailing slash)
const FRONTEND_DOMAIN = RAW_FRONTEND_DOMAIN.replace(/\/+$/, "");

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

// ---------- HELPERS ----------
function inferPlanFromSession(
  s: Stripe.Checkout.Session,
  starterId: string,
  proId: string,
): "starter" | "pro" | null {
  // Strongest signal: metadata set at session creation
  const m = s.metadata ?? {};
  if (m.plan === "starter" || m.plan === "pro") return m.plan as "starter" | "pro";

  // Fallback: price id from first line item
  const li = (s as any).line_items?.data?.[0];
  const priceId: string | undefined = li?.price?.id;
  if (priceId === starterId) return "starter";
  if (priceId === proId) return "pro";
  return null;
}

function isPaidLike(session: Stripe.Checkout.Session): boolean {
  if (session.payment_status === "paid") return true;
  if (session.status === "complete" && session.payment_status === "paid") return true;

  // Look at the PaymentIntent too
  const pi = session.payment_intent && typeof session.payment_intent !== "string"
    ? (session.payment_intent as Stripe.Response<Stripe.PaymentIntent>)
    : null;

  if (!pi) return false;
  if (pi.status === "succeeded") return true;
  // Optional: if you ever capture later
  if (pi.status === "requires_capture") return true;

  // Some processors mark charge as succeeded before PI status flips
  const anyChargeSucceeded = pi.charges?.data?.some(
    (c) => c.paid && c.status === "succeeded",
  );
  return Boolean(anyChargeSucceeded);
}

function isStillProcessing(session: Stripe.Checkout.Session): boolean {
  if (session.payment_status === "processing") return true;

  const pi = session.payment_intent && typeof session.payment_intent !== "string"
    ? (session.payment_intent as Stripe.Response<Stripe.PaymentIntent>)
    : null;

  if (!pi) return false;
  if (pi.status === "processing") return true;
  if (pi.status === "requires_action" || (pi as any).next_action) return true;
  return false;
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
    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id || typeof session_id !== "string") {
      return json({ error: "Missing session_id" }, { status: 400 }, req);
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items.data.price", "payment_intent.charges.data"],
    });

    if (isPaidLike(session)) {
      const plan = inferPlanFromSession(session, STARTER_PRICE_ID, PRO_PRICE_ID);
      if (!plan) {
        return json({ ok: false, reason: "unknown_plan" }, { status: 500 }, req);
      }
      return json(
        {
          ok: true,
          plan,
          session_id,
          assessment_id: session.metadata?.assessment_id ?? null,
        },
        { status: 200 },
        req,
      );
    }

    if (isStillProcessing(session)) {
      // IMPORTANT: 200 + pending:true so your UI keeps polling instead of showing an error
      return json(
        { ok: false, pending: true, session_status: session.status },
        { status: 200 },
        req,
      );
    }

    // Not paid and not processing => real failure / abandoned
    return json(
      { ok: false, reason: "unpaid", session_status: session.status },
      { status: 402 },
      req,
    );
  } catch (err) {
    console.error("[verify-payment] Error:", err);
    return json({ ok: false, error: "verification_failed" }, { status: 500 }, req);
  }
});
