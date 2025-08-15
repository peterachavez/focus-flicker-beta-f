
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GameCard, { CardData } from './GameCard';

interface DemoTrialProps {
  onNext: () => void;
}

const DemoTrial = ({ onNext }: DemoTrialProps) => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | null>(null);

  // Demo cards - Low Interference: correct matches only by color, distractors share NO features
  const targetCard: CardData = { color: 'blue', shape: 'circle', number: 2 };
  const responseCards: CardData[] = [
    { color: 'blue', shape: 'square', number: 1 }, // Correct - matches ONLY color (blue)
    { color: 'red', shape: 'triangle', number: 3 }, // Distractor - NO shared features with target
    { color: 'green', shape: 'diamond', number: 4 } // Distractor - NO shared features with target
  ];

  const correctAnswer = 0; // First card matches by color only
  const rule = 'color';
  const targetColor = 'blue';

  const handleCardSelect = (cardIndex: number) => {
    if (showFeedback) return; // Prevent switching after selection
    
    setSelectedCard(cardIndex);
    const isCorrect = cardIndex === correctAnswer;
    setFeedbackType(isCorrect ? 'correct' : 'incorrect');
    setShowFeedback(true);
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
                  Match the top card to one of the bottom cards based on <span className="underline">color</span>.
                </p>
                <p className="text-sm text-gray-600 text-center">
                  Look for the card that has the same color as the target card above.
                </p>
              </div>
            </div>

            {/* Game Area */}
            <div className="flex flex-col items-center space-y-10">
              {/* Target Card */}
              <div className="text-center">
                <p className="text-gray-600 mb-4 text-lg">Match this card:</p>
                <GameCard card={targetCard} size="large" />
              </div>

              {/* Response Cards */}
              <div className="flex justify-center space-x-12">
                {responseCards.map((card, index) => (
                  <div key={index} className="relative">
                    <GameCard
                      card={card}
                      onClick={() => handleCardSelect(index)}
                      isClickable={!showFeedback}
                      isSelected={selectedCard === index}
                      showFeedback={
                        showFeedback 
                          ? (index === correctAnswer ? 'correct' : (selectedCard === index ? 'incorrect' : null))
                          : null
                      }
                      size="large"
                    />
                    {/* Feedback Icons */}
                    {showFeedback && index === correctAnswer && (
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                    {showFeedback && selectedCard === index && index !== correctAnswer && (
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">✗</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Feedback Section */}
              {showFeedback && (
                <div className="text-center space-y-6 max-w-2xl">
                  {feedbackType === 'correct' ? (
                    <div className="space-y-4">
                      <p className="text-green-700 text-lg font-medium">
                        ✓ Correct! You matched by {rule} ({targetColor}).
                      </p>
                      <p className="text-gray-600 text-base">
                        Notice how both cards share the same {targetColor} color, even though they have different shapes and quantities.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-red-700 text-lg font-medium">
                        ✗ Incorrect. The correct answer was the {targetColor} card.
                      </p>
                      <p className="text-gray-600 text-base">
                        Notice how both cards share the same {targetColor} color, even though they have different shapes and quantities.
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

export default DemoTrial;
