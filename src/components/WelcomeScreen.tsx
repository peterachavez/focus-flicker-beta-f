import React from 'react';
import { Button } from "@/components/ui/button";

type WelcomeScreenProps = {
  onStartFocusFlicker: () => void;
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartFocusFlicker }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6">
      <div className="text-center max-w-2xl mx-auto">
        {/* Cogello Logo */}
        <div className="mb-8">
          <img
            src="/logo/cogello-transparent.png"
            alt="Cogello"
            className="h-16 mx-auto mb-6"
          />
        </div>

        {/* Tagline */}
        <div className="mb-12">
          <h1 className="text-5xl font-light text-gray-900 mb-6 leading-tight">
            👋 Say hello to cognition.
          </h1>
          <p className="text-2xl text-gray-600 font-light">
            Measure what matters.
          </p>
        </div>

        {/* Assessment Info */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Focus Flicker</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            A research-grade sustained attention task that adapts to your performance.
            Takes approximately 5 minutes to complete.
          </p>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onStartFocusFlicker}
          className="bg-[#149854] hover:bg-[#0f7a42] text-white px-8 py-3 text-lg font-medium rounded-lg transition-all duration-200 hover:shadow-lg"
        >
          Start Assessment
        </Button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
