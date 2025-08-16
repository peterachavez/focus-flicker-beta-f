import React, { useState, useEffect, KeyboardEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

function ensureAssessmentId() {
  let id = localStorage.getItem('current_assessment_id');
  if (!id || !id.startsWith('ff_')) {
    id = `ff_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    localStorage.setItem('current_assessment_id', id);
  }
  return id;
}

interface PricingTiersProps {
  onTierSelect: (tier: string) => void;
}

type TierId = 'free' | 'starter' | 'pro';

const PricingTiers = ({ onTierSelect }: PricingTiersProps) => {
  // Default to pro (pre-selected)
  const [selectedTier, setSelectedTier] = useState<TierId>('pro');
  const [isLoading, setIsLoading] = useState(false);
  const [isFlicker, setIsFlicker] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('assessment_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        setIsFlicker(parsed?.task === 'focusFlicker');
      }
      // restore previous selection if you want:
      const savedTier = localStorage.getItem('selected_tier') as TierId | null;
      if (savedTier === 'free' || savedTier === 'starter' || savedTier === 'pro') {
        setSelectedTier(savedTier);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  /** Select a card WITHOUT taking action */
  const handleCardSelect = (tierId: TierId) => {
    setSelectedTier(tierId);
    localStorage.setItem('selected_tier', tierId);
  };

  /** Keyboard support for selection (space/enter) */
  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>, tierId: TierId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardSelect(tierId);
    }
  };

  /** Pressing the CTA actually performs the action */
  const handleProceed = async () => {
    const tierId = selectedTier;
    // gate id you saved earlier in your flow
    const assessmentId = ensureAssessmentId();
      localStorage.getItem('current_assessment_id') ||
      (window as any).current_assessment_id ||
      '';

    if (!assessmentId && tierId !== 'free') {
      alert('Missing assessment ID. Please restart the assessment.');
      return;
    }

    if (tierId === 'free') {
      onTierSelect('free');
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        method: 'POST',
        body: {
          // Name both for compatibility with prior function versions
          plan: tierId,
          tier: tierId,
          assessment_id: assessmentId,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Checkout failed: No checkout URL');
      window.location.assign(data.url);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Checkout failed');
    } finally {
      setIsLoading(false);
    }
  };

  const tiers = [
    {
      id: 'free' as const,
      name: 'Free',
      price: '$0',
      description: 'Basic metrics from your assessment',
      features: isFlicker
        ? [
            'Flicker Threshold Score',
            'Number of Hits',
            'Count of False Alarms',
            'Basic performance summary',
            'Immediate digital results',
          ]
        : [
            'Cognitive Flexibility Score',
            'Number of Shifts Achieved',
            'Count of Perseverative Errors',
            'Basic performance summary',
            'Immediate digital results',
          ],
    },
    {
      id: 'starter' as const,
      name: 'Starter',
      price: '$19.99',
      description: 'Unlock deeper insights with AI interpretation and visualizations',
      features: [
        'All features from Free',
        'AI-generated plain-language summary',
        isFlicker ? 'Adaptive timing insights' : 'Adaptation latency insights',
        isFlicker ? 'Detection time breakdown' : 'Response time breakdown',
        'Deeper performance analysis',
      ],
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      price: '$29.99',
      description: 'Advanced analysis and export options for professional use',
      features: [
        'All features from Starter',
        isFlicker ? 'Clinical-style interpretation of attentional metrics' : 'Clinical-style interpretation',
        'Legal/educational-use summary',
        'Downloadable PDF and CSV reports',
        'Raw data access',
      ],
      popular: true,
    },
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

        {/* Pricing Cards (selection only) */}
        <div
          className="grid md:grid-cols-3 gap-6 mb-8"
          role="radiogroup"
          aria-label="Select a pricing plan"
        >
          {tiers.map((tier) => {
            const isSelected = selectedTier === tier.id;
            return (
              <Card
                key={tier.id}
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                className={`relative shadow-lg transition-all duration-200 hover:shadow-xl cursor-pointer outline-none
                  ${isSelected ? 'border-2 border-[#149854] bg-[#149854]/5' : 'border border-gray-200 hover:border-gray-300'}
                `}
                onClick={() => handleCardSelect(tier.id)}
                onKeyDown={(e) => handleCardKeyDown(e, tier.id)}
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
                  {isSelected && (
                    <div className="absolute top-4 right-4" aria-hidden="true">
                      <div className="w-6 h-6 bg-[#149854] rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Single CTA triggers the action */}
        <div className="text-center mb-8">
          <Button
            onClick={handleProceed}
            disabled={isLoading}
            className="bg-[#149854] hover:bg-[#149854]/90 text-white px-12 py-4 text-lg font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-70"
          >
            {isLoading
              ? 'Processing...'
              : selectedTierData?.id === 'pro'
                ? 'Unlock Results - $29.99'
                : selectedTierData?.id === 'starter'
                  ? 'Unlock Results - $19.99'
                  : 'Select Free Plan - $0'}
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
