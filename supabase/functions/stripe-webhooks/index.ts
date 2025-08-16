// supabase/functions/stripe-webhooks/index.ts
// Deno (Supabase Edge) runtime

import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- Required env secrets ---
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const STRIPE_SECRET_KEY     = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS utilities
const FRONTEND = Deno.env.get("FRONTEND_DOMAIN") || "";
const ALLOWED_ORIGINS = new Set([
  FRONTEND.replace(/\/$/, ""),          // prod
  "http://localhost:5173",              // Vite
  "http://localhost:3000",              // Next/CRA
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
]);

// early return for OPTIONS
function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("Origin")) });
  }
  return null;
}

// helper to wrap JSON with CORS
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req.headers.get("Origin")) },
  });
}

// Stripe client (Edge-friendly HTTP client)
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  // apiVersion: "2024-12-18" as any, // optional: use your acct default
});

// Supabase admin client (service role)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Helper: normalize plan
type Plan = "starter" | "pro";
const normalizePlan = (p?: string | null): Plan => (p === "pro" ? "pro" : "starter");

// For quick health checks
function ok(msg: string) { return new Response(msg, { status: 200 }); }
function bad(msg: string, code = 400) {
  console.error("[stripe-webhooks] " + msg);
  return new Response(msg, { status: code });
}

Deno.serve(async (req) => {
  // Simple GET health check, handy in dashboard
  if (req.method === "GET") return ok("stripe-webhooks up");

  if (req.method !== "POST") return bad("Method not allowed", 405);

  // We need the raw body for signature verification
  const signature = req.headers.get("stripe-signature");
  if (!signature) return bad("Missing Stripe-Signature header", 400);

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // ✅ async version fixes the SubtleCryptoProvider sync error
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const msg = (err as any)?.message || String(err);
    return bad(`Webhook signature verification failed: ${msg}`, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only act on successful payments
        if (session.payment_status !== "paid") {
          console.log("[webhook] session not paid, skipping:", session.id, session.payment_status);
          return ok("ignored (not paid)");
        }

        // Pull metadata
        const meta = session.metadata ?? {};
        const plan: Plan = normalizePlan(meta.plan);
        const access_token = meta.access_token || null;
        const providedAssessmentId = meta.assessment_id || null;

        // Ensure we never violate NOT NULL on results_access.assessment_id
        const assessment_id =
          providedAssessmentId ||
          access_token ||
          `session:${session.id}`;

        console.log("[webhook] upserting results_access:", {
          plan,
          session_id: session.id,
          assessment_id,
          hadProvidedAssessmentId: Boolean(providedAssessmentId),
          hadAccessToken: Boolean(access_token),
        });

        // Upsert based on assessment_id
        const { error } = await supabase
          .from("results_access")
          .upsert(
            {
              assessment_id,
              plan_tier: plan,
              session_id: session.id,
            },
            { onConflict: "assessment_id" }
          );

        if (error) {
          console.error("[webhook] DB upsert error:", error);
          // Return 200 so Stripe doesn't retry forever, but log the error.
          return ok("received (db upsert error logged)");
        }

        return ok("received");
      }

      // Nice to ignore common noise
      case "checkout.session.expired":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        console.log("[webhook] ignoring event:", event.type);
        return ok("ignored");

      default:
        console.log("[webhook] unhandled event:", event.type);
        return ok("unhandled");
    }
  } catch (err) {
    console.error("[webhook] handler error:", err);
    // Still return 200 to avoid Stripe retries if the bug is in our code;
    // leave a clear log to debug in Supabase Edge logs.
    return ok("received (handler error logged)");
  }
});