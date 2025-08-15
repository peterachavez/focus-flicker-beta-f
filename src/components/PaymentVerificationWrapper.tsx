import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import ResultsDashboard from './ResultsDashboard';
import { AssessmentData } from '../pages/Index';

interface PaymentVerificationWrapperProps {
  data: AssessmentData;
  tier: string;            // 'free' | 'starter' | 'pro'
  sessionId?: string;      // optional, from ?session_id=...
}

interface VerificationResult {
  verified: boolean;
  plan_tier?: 'starter' | 'pro';
  error?: string;
  details?: string;
}

const PaymentVerificationWrapper = ({ data, tier, sessionId }: PaymentVerificationWrapperProps) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifiedTier, setVerifiedTier] = useState<string>(tier);

  useEffect(() => {
    // prefer prop, fallback to URL param
    const idFromUrl = (() => {
      try {
        const u = new URL(window.location.href);
        return u.searchParams.get('session_id') || undefined;
      } catch {
        return undefined;
      }
    })();

    const id = sessionId || idFromUrl;

    // Free -> nothing to verify
    if (tier === 'free') {
      setVerificationResult({ verified: true });
      return;
    }

    // Starter/Pro must verify if we have a session_id
    if ((tier === 'starter' || tier === 'pro') && id) {
      verifyPayment(id);
    }
  }, [sessionId, tier]);

  const verifyPayment = async (id: string) => {
    setIsVerifying(true);
    try {
      const { data: verifyData, error } = await supabase.functions.invoke('verify-payment', {
        method: 'POST',
        body: { session_id: id }, // no Authorization header – function is deployed with --no-verify-jwt
      });

      if (error) {
        setVerificationResult({
          verified: false,
          error: 'Payment verification failed.',
          details: error.message
        });
        return;
      }

      if (verifyData?.verified) {
        const plan = verifyData.plan_tier as 'starter' | 'pro';
        setVerificationResult({ verified: true, plan_tier: plan });
        setVerifiedTier(plan);
      } else {
        setVerificationResult({
          verified: false,
          error: verifyData?.error || 'Payment could not be verified',
          details: verifyData?.details
        });
      }
    } catch (err: any) {
      setVerificationResult({
        verified: false,
        error: 'Unexpected error verifying payment.',
        details: err?.message || String(err)
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              Verifying Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Checking with Stripe…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationResult && !verificationResult.verified && (tier === 'starter' || tier === 'pro')) {
    const fallbackId = sessionId || new URL(window.location.href).searchParams.get('session_id') || '';
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
              <p className="text-red-800 font-medium mb-1">{verificationResult.error}</p>
              {verificationResult.details && (
                <p className="text-red-700 text-sm">Details: {verificationResult.details}</p>
              )}
            </div>
            <Button onClick={() => verifyPayment(fallbackId)} disabled={!fallbackId}>
              Retry Verification
            </Button>
            <div className="text-xs text-gray-500 mt-2">Session ID: {fallbackId || 'none'}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationResult?.verified && (verifiedTier === 'starter' || verifiedTier === 'pro')) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-green-50 border-b border-green-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-green-800 font-medium">Payment verified!</p>
              <p className="text-green-700 text-sm">
                Your {verifiedTier === 'pro' ? 'Pro' : 'Starter'} results are unlocked.
              </p>
            </div>
          </div>
        </div>
        <ResultsDashboard data={data} tier={verifiedTier} />
      </div>
    );
  }

  // Default
  return <ResultsDashboard data={data} tier={verifiedTier} />;
};

export default PaymentVerificationWrapper;
