// supabase/functions/test-insert/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SERVICE_ROLE_KEY"));
serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Method not allowed"
      }), {
        status: 405
      });
    }
    const { assessment_id, plan } = await req.json().catch(()=>({}));
    if (!plan) {
      return new Response(JSON.stringify({
        error: "plan is required"
      }), {
        status: 400
      });
    }
    const { error } = await supabase.from("results_access").insert({
      assessment_id: assessment_id ?? null,
      plan,
      session_id: "manual-test"
    });
    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500
      });
    }
    return new Response("Row inserted", {
      status: 200
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({
      error: "server error"
    }), {
      status: 500
    });
  }
});
