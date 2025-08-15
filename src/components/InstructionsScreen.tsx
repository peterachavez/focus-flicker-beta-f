
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InstructionsScreenProps {
  onNext: () => void;
}

const InstructionsScreen = ({ onNext }: InstructionsScreenProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-gray-800 mb-8">
                Instructions
              </h1>
            </div>

            <div className="space-y-8 text-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Task</h2>
                <p className="leading-relaxed">
                  You will see one card at the top and three cards below. Your goal is to match the top 
                  card with one of the three cards below by clicking on it.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">The Rules</h2>
                <p className="leading-relaxed">
                  Cards can be matched by <strong>color</strong>, <strong>shape</strong>, or <strong>quantity</strong>. The correct matching rule is 
                  hidden and will change during the task without warning.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Challenge</h2>
                <p className="leading-relaxed">
                  You must figure out the current rule through trial and error, then adapt when it changes. 
                  Pay attention to the feedback to discover the pattern.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> When you get several wrong in a row, the rule has likely changed. Stay flexible and try a different 
                  approach.
                </p>
              </div>
            </div>

            <div className="flex justify-center mt-8">
              <Button 
                onClick={onNext}
                className="bg-[#149854] hover:bg-[#0f7a42] text-white px-8 py-3 text-base font-medium rounded-lg"
              >
                Start Demo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstructionsScreen;
