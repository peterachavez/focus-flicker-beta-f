import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import ResultsDashboard from "./ResultsDashboard";
import { AssessmentData } from "../pages/Index";

type Tier = "free" | "starter" | "pro";

interface PaymentVerificationWrapperProps {
  data: AssessmentData;
  tier: Tier;             // incoming hint (ignored for verification)
  sessionId?: string;     // ?session_id=...
}

interface VerificationResult {
  ok: boolean;
  verified: boolean;
  plan?: Exclude<Tier, "free">;
  assessment_id?: string | null;
  error?: string;
}

function parseSessionId(): string | undefined {
  try {
    const u = new URL(window.location.href);
    const raw = u.searchParams.get("session_id") || undefined;
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
  const [showNoLocalResults, setShowNoLocalResults] = useState(false);

  const session = useMemo(() => sessionId || parseSessionId(), [sessionId]);
  const assessmentId = useMemo(() => getAssessmentId(), []);

  const hasLocalResults = useMemo(() => {
    try {
      return !!data && Object.keys(data || {}).length > 0;
    } catch {
      return false;
    }
  }, [data]);

  const fetchGrantedFromDB = async (): Promise<Tier | undefined> => {
    if (!assessmentId) return undefined;
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
            assessment_id: assessmentId ?? null,
          },
        }
      );

      if (error) {
        return {
          ok: false,
          verified: false,
          error: error.message || "Payment verification failed.",
        };
      }

      return {
        ok: !!verifyData?.ok,
        verified: !!verifyData?.verified,
        plan: verifyData?.plan,
        assessment_id: verifyData?.assessment_id ?? null,
        error: verifyData?.error,
      };
    } catch (e: any) {
      return {
        ok: false,
        verified: false,
        error: e?.message || "Unexpected error verifying payment.",
      };
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsBusy(true);

      // PRIMARY: if we have a session_id from Stripe, ALWAYS verify (ignore 'tier' hint)
      if (session) {
        const v = await callVerify(session);
        if (!cancelled) {
          setVerification(v);
          if (v.ok && v.verified && v.plan) {
            setGrantedTier(v.plan); // 'pro' | 'starter'
            localStorage.setItem("access_plan", v.plan);
            localStorage.removeItem("selected_tier");
            setShowNoLocalResults(!hasLocalResults);
            setIsBusy(false);
            return;
          }
          // fall through if verification didn't succeed
        }
      }

      // SECONDARY: no session_id or verification failed -> check DB for prior grants
      const dbPlan = await fetchGrantedFromDB();
      if (!cancelled && dbPlan && dbPlan !== "free") {
        setGrantedTier(dbPlan as "starter" | "pro");
        setVerification({ ok: true, verified: true, plan: dbPlan as "starter" | "pro" });
        setShowNoLocalResults(!hasLocalResults);
        setIsBusy(false);
        return;
      }

      // FINAL: nothing verified -> free with explicit message
      setGrantedTier("free");
      setVerification(
        tier === "free" && !session
          ? { ok: true, verified: true } // Free flow: no error, no red card
          : {
              ok: false,
              verified: false,
              error: session
                ? "Payment could not be verified."
                : "Missing checkout session.",
            }
      );
      setIsBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]); // note: 'tier' intentionally NOT used for verification

  if (isBusy) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
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

    // Only show the failure card if this was a paid flow (starter/pro) or there *is* a session
    // Free (no session) should *not* show an error card
    if (verification && !verification.verified && (tier === "starter" || tier === "pro" || !!session)) {
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
              <p className="text-red-800 font-medium mb-1">
                {verification.error || "We couldn’t verify your payment."}
              </p>
              <p className="text-red-700 text-sm">
                You can retry below. If this persists, please contact support with your session ID.
              </p>
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

  const showSuccess =
    verification?.verified && (grantedTier === "starter" || grantedTier === "pro");

  return (
    <div className="min-h-screen bg-gray-50">
      {showSuccess && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Payment verified!</p>
              <p className="text-sm">
                Your {grantedTier === "pro" ? "Pro" : "Starter"} results are unlocked.
              </p>
            </div>
          </div>
        </div>
      )}

      {showSuccess && showNoLocalResults && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-start gap-3">
            <Info className="h-5 w-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Verified, but no local assessment found.</p>
              <p>
                It looks like this device doesn’t have the test data you just unlocked.
                Please open the results from the device you used to run the test, or
                re-run the quick assessment here.
              </p>
            </div>
          </div>
        </div>
      )}

      <ResultsDashboard data={data} tier={grantedTier} />
    </div>
  );
}
