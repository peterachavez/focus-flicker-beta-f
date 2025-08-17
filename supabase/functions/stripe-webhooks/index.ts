// supabase/functions/stripe-webhooks/index.ts
import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const STRIPE_SECRET_KEY     = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type Plan = "starter" | "pro";
const normalizePlan = (p?: string | null): Plan => (p === "pro" ? "pro" : "starter");

function ok(msg: string) { return new Response(msg, { status: 200 }); }
function bad(msg: string, code = 400) {
  console.error("[stripe-webhooks] " + msg);
  return new Response(msg, { status: code });
}

Deno.serve(async (req) => {
  if (req.method === "GET") return ok("stripe-webhooks up");
  if (req.method !== "POST") return bad("Method not allowed", 405);

  const signature = req.headers.get("stripe-signature");
  if (!signature) return bad("Missing Stripe-Signature header", 400);

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // ✅ async verification avoids SubtleCrypto sync issues
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = (err as any)?.message || String(err);
    return bad(`Webhook signature verification failed: ${msg}`, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== "paid") {
          console.log("[webhook] not paid; skipping:", session.id, session.payment_status);
          return ok("ignored");
        }

        const meta = session.metadata ?? {};
        const plan: Plan = normalizePlan(meta.plan);
        const assessment_id =
          meta.assessment_id ||
          meta.access_token ||           // fallback if you pass a token
          `session:${session.id}`;       // last resort, won’t violate NOT NULL

        // Append-only insert (no upsert)
        const { error } = await supabase.from("results_access").insert({
          assessment_id,
          plan,
          session_id: session.id,
        });

        if (error) {
          console.warn("[webhook] insert warning:", error.message);
          return ok("received (insert warning)"); // never 500 on harmless duplicates
        }
        return ok("received");
      }

      case "checkout.session.expired":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        console.log("[webhook] ignored:", event.type);
        return ok("ignored");

      default:
        console.log("[webhook] unhandled:", event.type);
        return ok("unhandled");
    }
  } catch (err) {
    console.error("[webhook] handler error:", err);
    return ok("received (handler error logged)");
  }
});
