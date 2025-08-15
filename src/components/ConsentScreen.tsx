
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ConsentScreenProps {
  onNext: () => void;
}

const ConsentScreen = ({ onNext }: ConsentScreenProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-gray-800 mb-4">
                Research Disclosure
              </h1>
            </div>

            <div className="space-y-6 text-gray-700">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm leading-relaxed">
                  <strong>Important:</strong> This is a research-grade sustained attention tool. 
                  Results may inform clinical, educational, or legal decisions.
                </p>
              </div>

              <div className="space-y-4 text-sm">
                <h3 className="font-semibold text-gray-800">What you should know:</h3>
                <ul className="space-y-2 list-disc list-inside text-gray-600 pl-4">
                  <li>This assessment measures sustained attention and executive function</li>
                  <li>Your responses will be analyzed for research purposes</li>
                  <li>Results are generated using validated psychological metrics</li>
                  <li>Data is collected anonymously and securely</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  By continuing, you consent to participate in this cognitive assessment 
                  and understand that results may be used for decision-making purposes.
                </p>
              </div>
            </div>

            <div className="flex justify-center mt-8">
              <Button 
                onClick={onNext}
                className="bg-[#149854] hover:bg-[#0f7a42] text-white px-8 py-3 text-base font-medium rounded-lg"
              >
                I Understand and Consent
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsentScreen;
