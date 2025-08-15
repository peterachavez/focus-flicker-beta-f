
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PricingTiersProps {
  onTierSelect: (tier: string) => void;
}

const PricingTiers = ({ onTierSelect }: PricingTiersProps) => {
  const [selectedTier, setSelectedTier] = useState('pro');
  const [isLoading, setIsLoading] = useState(false);

  const handlePlanSelection = async () => {
  if (selectedTier === "free") {
    // Persist the free choice too
    localStorage.setItem("selected_tier", "free");
    onTierSelect("free");
    return;
  }

  // Must have an assessment id from the finished task
  const assessmentId = localStorage.getItem("current_assessment_id");
  if (!assessmentId) {
    alert("No assessment found. Please complete the assessment first.");
    return;
  }

  // Persist the paid plan immediately so the results page can use it
  localStorage.setItem("selected_tier", selectedTier);

  // Stable token so webhooks/verification can tie back to the same browser
  let accessToken = localStorage.getItem("results_access_token");
  if (!accessToken) {
    accessToken = crypto.randomUUID();
    localStorage.setItem("results_access_token", accessToken);
  }

  setIsLoading(true);
  try {
    // 1) Preferred path: your Edge Function (lets you include allow_promotion_codes, success_url with tier, etc.)
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: {
        plan: selectedTier,               // 'starter' | 'pro'
        assessment_id: assessmentId,
        access_token: accessToken,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error("No checkout URL returned");

    window.location.href = data.url; // Go to Stripe Checkout
  } catch (err: any) {
    console.warn("Falling back to Stripe Payment Link:", err?.message || err);

    // 2) Fallback: REAL Stripe Payment Links (configured in Dashboard)
    //    Replace the placeholders below with your actual Payment Link URLs.
    const PAYMENT_LINKS: Record<string, string> = {
      starter: "https://pay.cogello.com/b/dRmeVd9QgbfK8l96gy5ZC02", // 
      pro:     "https://pay.cogello.com/b/bJebJ16E41Fa1WL7kC5ZC03", // 
    };

    const link = PAYMENT_LINKS[selectedTier];
    if (!link) {
      alert("Invalid plan selected.");
      setIsLoading(false);
      return;
    }

    // IMPORTANT: in the Stripe Dashboard, set each Payment Link’s
    // Success URL to:
    //   https://flex-sort.cogello.com/?checkout=success&session_id={CHECKOUT_SESSION_ID}&tier=<starter-or-pro>
    // That way, when Stripe redirects back, your Index/useEffect picks up ?session_id and ?tier.

    window.location.href = link;
  } finally {
    setIsLoading(false);
  }
};


  const tiers = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      description: 'Basic metrics from your assessment',
      features: [
        'Cognitive Flexibility Score',
        'Number of Shifts Achieved',
        'Count of Perseverative Errors',
        'Basic performance summary',
        'Immediate digital results'
      ]
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$19.99',
      description: 'Unlock deeper insights with AI interpretation and visualizations',
      features: [
        'All features from Free',
        'AI-generated plain-language summary',
        'Adaptation latency insights',
        'Response time breakdown',
        'Deeper performance analysis'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$29.99',
      description: 'Advanced analysis and export options for professional use',
      features: [
        'All features from Starter',
        'Clinical-style interpretation',
        'Legal/educational-use summary',
        'Downloadable PDF and CSV reports',
        'Raw data access'
      ],
      popular: true
    }
  ];

  const selectedTierData = tiers.find(tier => tier.id === selectedTier);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 py-12">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header with green checkmark */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-[#149854] rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-800 mb-4">
            Your cognitive profile is ready
          </h1>
          <p className="text-gray-600 text-lg">
            Select a pricing tier to unlock your personalized results
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {tiers.map((tier) => (
            <Card 
              key={tier.id} 
              className={`relative shadow-lg transition-all duration-200 hover:shadow-xl cursor-pointer ${
                selectedTier === tier.id
                  ? 'border-2 border-[#149854] bg-[#149854]/5' 
                  : 'border border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                setSelectedTier(tier.id);
                localStorage.setItem("selected_tier", tier.id);
              }}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-[#149854] text-white px-4 py-1 text-sm">Most Popular</Badge>
                </div>
              )}
              
              <CardContent className="p-8 text-center h-full flex flex-col">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {tier.name}
                </h3>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {tier.price}
                </div>
                <p className="text-gray-600 text-sm mb-6">
                  {tier.description}
                </p>

                <ul className="space-y-3 mb-8 text-left flex-grow">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <Check className="w-4 h-4 text-[#149854] mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Selection indicator */}
                {selectedTier === tier.id && (
                  <div className="absolute top-4 right-4">
                    <div className="w-6 h-6 bg-[#149854] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Single centered button below cards */}
        <div className="text-center mb-8">
          <Button 
            onClick={handlePlanSelection}
            disabled={isLoading}
            className="bg-[#149854] hover:bg-[#149854]/90 text-white px-12 py-4 text-lg font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 
             selectedTierData?.id === 'pro' ? 'Unlock Results - $29.99' : 
             selectedTierData?.id === 'starter' ? 'Unlock Results - $19.99' : 
             'Select Free Plan - $0'}
          </Button>
        </div>

        {/* Bottom disclaimer */}
        <div className="text-center">
          <p className="text-xs text-gray-500 max-w-2xl mx-auto">
            Secure payment processing. All reports include privacy protection and are available immediately after purchase. 
            7-day money-back guarantee if you're not satisfied with your results.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingTiers;
