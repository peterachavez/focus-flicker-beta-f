// Deno Edge Function: ping
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const url = Deno.env.get("SUPABASE_URL")!;
const service =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;

const db = createClient(url, service, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("nope", { status: 405 });

  const { plan = "starter", assessment_id = "ping-test" } = await req.json()
    .catch(() => ({}));

  const { error } = await db.from("results_access").insert({
    assessment_id,
    plan,
    session_id: `ping_${crypto.randomUUID()}`,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("PING insert error:", error);
    return new Response("DB insert failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
