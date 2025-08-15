import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FocusFlickerInstructionsProps = {
  onNext: () => void;
};

const FocusFlickerInstructions: React.FC<FocusFlickerInstructionsProps> = ({ onNext }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-3xl w-full">
        <Card className="shadow-lg border-0">
          <CardContent className="p-10">
            <h1 className="text-3xl font-semibold text-center mb-10">Instructions</h1>

            {/* Your Task */}
<section className="mb-8">
  <h2 className="text-lg font-semibold text-gray-900 mb-2">Your Task</h2>
  <p className="text-gray-700 leading-relaxed">
    You will see one card that flickers between two versions. Your goal is to decide
    whether a change occurred by selecting <strong>Change</strong> or <strong>No Change</strong>.
  </p>
</section>

<section className="mb-8">
  <h2 className="text-lg font-semibold text-gray-900 mb-2">The Rules</h2>
  <p className="text-gray-700 leading-relaxed">
    A change can be in <strong>color</strong>, <strong>shape</strong>, or <strong>quantity</strong>.
    Some trials have <strong>no change</strong>. Respond as soon as you are confident.
  </p>
</section>

<section className="mb-8">
  <h2 className="text-lg font-semibold text-gray-900 mb-2">Your Challenge</h2>
  <p className="text-gray-700 leading-relaxed">
    The flicker speed <strong>adapts</strong> to your performance. Both <strong>speed</strong> and
    <strong> accuracy</strong> are tracked.
  </p>
</section>


            {/* Tip box */}
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 mb-8">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Tip:</span> If you’re unsure, the change may be subtle.
                Let another flicker cycle pass to confirm.
              </p>
            </div>

            <div className="text-center">
              <Button
                onClick={onNext}
                className="bg-[#149854] hover:bg-[#149854]/90 text-white px-8 py-3 text-lg font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
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

export default FocusFlickerInstructions;
