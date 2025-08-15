// Deno runtime (Supabase Edge Functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { access_token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const access_token = body.access_token?.trim();
  if (!access_token) {
    return new Response("Missing access_token", { status: 400 });
  }

  const { data, error } = await supabase
    .from("results_access")
    .select("assessment_id, plan, session_id, created_at")
    .eq("access_token", access_token)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("get-results-by-token query error:", error);
    return new Response("DB error", { status: 500 });
  }

  if (!data) {
    return new Response(JSON.stringify({ found: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ found: true, ...data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
