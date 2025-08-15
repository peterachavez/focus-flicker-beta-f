import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GameCard, { CardData } from './GameCard';

interface FocusFlickerDemoProps {
  /**
   * Invoked when the participant completes the demo and is ready to move to
   * practice trials.
   */
  onNext: () => void;
}

/**
 * Demo component for the Focus Flicker task.  Presents a single flicker
 * example in which the top card alternates between a base and an altered
 * version.  The participant is prompted to decide whether a change
 * occurred.  Feedback is provided along with a continue button.
 */
const FocusFlickerDemo = ({ onNext }: FocusFlickerDemoProps) => {
  // Define the base and altered cards for the demo.  The base card has two
  // blue circles; the altered card changes to two green circles.  This
  // ensures the participant can easily notice a difference on their first
  // exposure to the paradigm.
  const baseCard: CardData = { color: 'blue', shape: 'circle', number: 2 };
  const alteredCard: CardData = { color: 'green', shape: 'circle', number: 2 };
  const hasChange = true;

  const [showAltered, setShowAltered] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Flicker the card between base and altered every 500ms.  On unmount,
  // clear the interval to avoid memory leaks.
  useEffect(() => {
    const interval = setInterval(() => {
      setShowAltered(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleResponse = (choice: 'change' | 'nochange') => {
    if (hasResponded) return;
    const correct = (choice === 'change' && hasChange) || (choice === 'nochange' && !hasChange);
    setIsCorrect(correct);
    setHasResponded(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-4xl mx-auto w-full">
        <Card className="shadow-lg border-0 bg-white">
          <CardContent className="p-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-normal text-gray-800 mb-6">Demo</h1>
              {/* Instruction Box */}
              <div className="bg-blue-gray-50 border border-blue-gray-200 rounded-xl p-6 mb-4 shadow-sm max-w-2xl mx-auto">
                <p className="text-lg text-gray-800 font-bold text-center mb-2">
                  Watch the card.  Decide if there is a change.
                </p>
                <p className="text-sm text-gray-600 text-center">
                  Click <strong>Change</strong> if the two versions are different.
                  Click <strong>No Change</strong> if they remain the same.
                </p>
              </div>
            </div>
            {/* Game Area */}
            <div className="flex flex-col items-center space-y-10">
              {/* Flickering Card */}
              <div className="text-center">
                <p className="text-gray-600 mb-4 text-lg">Watch this card:</p>
                <GameCard card={showAltered ? alteredCard : baseCard} size="large" />
              </div>
              {/* Response Buttons */}
              {!hasResponded && (
                <div className="flex justify-center space-x-12">
                  <Button
                    onClick={() => handleResponse('change')}
                    className="bg-[#149854] hover:bg-[#0f7a42] text-white px-6 py-3 text-lg font-medium rounded-lg"
                  >
                    Change
                  </Button>
                  <Button
                    onClick={() => handleResponse('nochange')}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 text-lg font-medium rounded-lg"
                  >
                    No Change
                  </Button>
                </div>
              )}
              {/* Feedback Section */}
              {hasResponded && (
                <div className="text-center space-y-6 max-w-2xl">
                  {isCorrect ? (
                    <div className="space-y-4">
                      <p className="text-green-700 text-lg font-medium">
                        ✓ Correct!  There was a change between the two images.
                      </p>
                      <p className="text-gray-600 text-base">
                        Notice how the color changed from blue to green.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-red-700 text-lg font-medium">
                        ✗ Incorrect.  A change occurred.
                      </p>
                      <p className="text-gray-600 text-base">
                        The color changed from blue to green.
                      </p>
                    </div>
                  )}
                  <div className="pt-6">
                    <Button
                      onClick={onNext}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg rounded-lg font-medium"
                    >
                      Continue to Practice
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FocusFlickerDemo;