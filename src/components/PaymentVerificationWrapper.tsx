import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import ResultsDashboard from "./ResultsDashboard";
import { AssessmentData } from "../pages/Index";

type Tier = "free" | "starter" | "pro";

interface PaymentVerificationWrapperProps {
  data: AssessmentData;
  tier: Tier;             // user’s requested tier (from pricing)
  sessionId?: string;     // optional ?session_id=...
}

interface VerificationResult {
  verified: boolean;
  plan_tier?: Exclude<Tier, "free">;
  error?: string;
  details?: string;
}

function parseSessionId(): string | undefined {
  try {
    const u = new URL(window.location.href);
    const raw = u.searchParams.get("session_id") || undefined;
    // Just in case Stripe adds a fragment, strip it.
    return raw?.split("#")[0];
  } catch {
    return undefined;
  }
}

function getAssessmentId(): string | undefined {
  try {
    return (
      localStorage.getItem("current_assessment_id") ||
      (window as any).current_assessment_id ||
      undefined
    );
  } catch {
    return undefined;
  }
}

export default function PaymentVerificationWrapper({
  data,
  tier,
  sessionId,
}: PaymentVerificationWrapperProps) {
  const [isBusy, setIsBusy] = useState(true);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [grantedTier, setGrantedTier] = useState<Tier>("free");

  const session = useMemo(() => sessionId || parseSessionId(), [sessionId]);
  const assessmentId = useMemo(() => getAssessmentId(), []);

  // Query the DB to see if this assessment already has access
  const fetchGrantedFromDB = async (): Promise<Tier | undefined> => {
    if (!assessmentId) return undefined;

    // RLS is disabled on results_access in your project, so anon read is fine.
    const { data: rows, error } = await supabase
      .from("results_access")
      .select("plan")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("[results_access lookup] error:", error.message);
      return undefined;
    }
    const plan = rows?.[0]?.plan as Tier | undefined;
    return plan;
  };

  const callVerify = async (sid: string): Promise<VerificationResult> => {
    try {
      const { data: verifyData, error } = await supabase.functions.invoke(
        "verify-payment",
        {
          method: "POST",
          body: {
            session_id: sid,
            assessment_id: assessmentId, // let the function upsert with the right id
          },
        }
      );

      if (error) {
        return {
          verified: false,
          error: "Payment verification failed.",
          details: error.message,
        };
      }

      if (verifyData?.verified) {
        return {
          verified: true,
          plan_tier: verifyData.plan_tier as "starter" | "pro",
        };
      }

      return {
        verified: false,
        error: verifyData?.error || "Payment could not be verified.",
        details: verifyData?.details,
      };
    } catch (e: any) {
      return {
        verified: false,
        error: "Unexpected error verifying payment.",
        details: e?.message || String(e),
      };
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsBusy(true);

      // 1) FREE never needs verification
      if (tier === "free") { ... return; }

      // 2) If we have a session_id, verify FIRST (authoritative for this purchase)
      if (session) {
        const v = await callVerify(session);
        if (!cancelled) {
          setVerification(v);
          if (v.verified && v.plan_tier) {
            setGrantedTier(v.plan_tier);                   // 'pro' / 'starter' from Stripe
            // optional hygiene:
            localStorage.setItem('access_plan', v.plan_tier);
            localStorage.removeItem('selected_tier');
            setIsBusy(false);
            return;
          }
          // fall through to DB if verification didn't succeed
        }
      }

      // 3) No (or failed) verification → check DB for prior grants
      const dbPlan = await fetchGrantedFromDB();
      if (!cancelled && dbPlan && dbPlan !== "free") {
        setGrantedTier(dbPlan as "starter" | "pro");
        setVerification({ verified: true, plan_tier: dbPlan as "starter" | "pro" });
        setIsBusy(false);
        return;
      }

      // 4) Nothing verified → free with message
      // 4) No session, nothing in DB → show free while telling user we couldn’t verify
      if (!cancelled) {
        setGrantedTier("free");
        setVerification({
          verified: false,
          error: "Missing checkout session.",
          details:
            "We couldn’t find a Stripe session or prior access record for this assessment.",
        });
        setIsBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, session]);

  // ----- UI states -----
  if (isBusy) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              Verifying payment…
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Checking your access now.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verification && !verification.verified && (tier === "starter" || tier === "pro")) {
    const fallbackId = session || "";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-red-600">
              <XCircle className="h-6 w-6" />
              Payment Verification Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
              <p className="text-red-800 font-medium mb-1">{verification.error}</p>
              {verification.details && (
                <p className="text-red-700 text-sm">Details: {verification.details}</p>
              )}
            </div>
            <Button onClick={() => { window.location.reload(); }} variant="default">
              Retry
            </Button>
            {fallbackId && (
              <div className="text-xs text-gray-500 mt-2">Session ID: {fallbackId}</div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success banner when we’ve actually verified (DB or function)
  const showSuccess =
    verification?.verified && (grantedTier === "starter" || grantedTier === "pro");

  return (
    <div className="min-h-screen bg-gray-50">
      {showSuccess && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-green-800 font-medium">Payment verified!</p>
              <p className="text-green-700 text-sm">
                Your {grantedTier === "pro" ? "Pro" : "Starter"} results are unlocked.
              </p>
            </div>
          </div>
        </div>
      )}
      <ResultsDashboard data={data} tier={grantedTier} />
    </div>
  );
}
