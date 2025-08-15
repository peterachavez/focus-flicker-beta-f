
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PostAssessmentProps {
  onNext: () => void;
}

const PostAssessment = ({ onNext }: PostAssessmentProps) => {
  // Determine which task has just been completed by reading from localStorage.  
  // If the stored assessment data has a `task` field set to 'focusFlicker' we
  // tailor the messaging to the flicker paradigm.  Otherwise we default to
  // cognitive flexibility language.
  const [isFlicker, setIsFlicker] = React.useState(false);
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('assessment_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        setIsFlicker(parsed.task === 'focusFlicker');
      }
    } catch {
      // ignore parse errors and keep default false
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-0">
          <CardContent className="p-8 text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-[#149854] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🧠</span>
              </div>
              <h1 className="text-3xl font-semibold text-gray-800 mb-4">
                Assessment Complete
              </h1>
              <p className="text-xl text-gray-600">
                Your cognitive profile is ready.
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-gray-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-800 mb-3">What's Next?</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {isFlicker
                  ? 'We\'ve analyzed your performance across multiple change detection metrics. Choose a report tier to unlock your detailed results, including insights that can inform clinical, educational, or legal decisions.'
                  : 'We\'ve analyzed your performance across multiple cognitive flexibility metrics. Choose a report tier to unlock your detailed results, including insights that can inform clinical, educational, or legal decisions.'}
              </p>
            </div>

            <div className="space-y-4 text-sm text-gray-600 mb-8">
              {isFlicker ? (
                <>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Attention Score calculated</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Hit and false alarm patterns analyzed</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Response time metrics computed</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Adaptive timing measured</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Cognitive Flexibility Score calculated</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Rule-shifting patterns analyzed</span>
                  </div>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <span>Executive function metrics computed</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <span>Adaptation latency measured</span>
                    </div>
                </>
              )}
            </div>

            <Button 
              onClick={onNext}
              className="bg-[#149854] hover:bg-[#0f7a42] text-white px-8 py-3 text-lg font-medium rounded-lg"
            >
              View Report Options
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PostAssessment;
