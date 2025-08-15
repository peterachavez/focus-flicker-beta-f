
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GameCard, { CardData } from './GameCard';

interface PracticeTrialsProps {
  onNext: () => void;
}

interface PracticeTrialData {
  trial_number: number;
  user_choice: string;
  correct: boolean;
  rule: 'color' | 'shape' | 'number';
  response_time: number;
  perseverative: boolean;
  adaptation_latency: number;
  trial_type: 'practice';
  practice_phase: 'discovery' | 'confirmation' | 'incomplete';
  timestamp: number;
}

interface PracticeTrial {
  target: CardData;
  options: CardData[];
  correctIndex: number;
  rule: 'color' | 'shape' | 'number';
}

const PracticeTrials = ({ onNext }: PracticeTrialsProps) => {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | null>(null);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState<number>(0);
  const [currentTrial, setCurrentTrial] = useState<PracticeTrial | null>(null);
  const [trialNumber, setTrialNumber] = useState<number>(1);
  const [trialStartTime, setTrialStartTime] = useState<number>(0);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [confirmationComplete, setConfirmationComplete] = useState<boolean>(false);
  const [practiceData, setPracticeData] = useState<PracticeTrialData[]>([]);
  const [practiceRule, setPracticeRule] = useState<'shape' | 'number' | null>(null);

  // Generate a random card
  const generateCard = (): CardData => {
    const colors: CardData['color'][] = ['red', 'blue', 'green', 'yellow'];
    const shapes: CardData['shape'][] = ['circle', 'square', 'triangle', 'diamond'];
    const numbers: CardData['number'][] = [1, 2, 3, 4];
    
    return {
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      number: numbers[Math.floor(Math.random() * numbers.length)]
    };
  };

  // Generate a practice trial with Low Interference logic using consistent rule
  const generatePracticeTrial = (rule: 'shape' | 'number'): PracticeTrial => {
    const target = generateCard();
    
    const colors: CardData['color'][] = ['red', 'blue', 'green', 'yellow'];
    const shapes: CardData['shape'][] = ['circle', 'square', 'triangle', 'diamond'];
    const numbers: CardData['number'][] = [1, 2, 3, 4];
    
    // Create correct option that matches target on exactly one rule (the consistent practice rule)
    const correctOption = generateCard();
    
    // Set the matching dimension
    switch (rule) {
      case 'shape':
        correctOption.shape = target.shape;
        // Ensure different color and number
        const otherColors = colors.filter(c => c !== target.color);
        const otherNumbers = numbers.filter(n => n !== target.number);
        correctOption.color = otherColors[Math.floor(Math.random() * otherColors.length)];
        correctOption.number = otherNumbers[Math.floor(Math.random() * otherNumbers.length)];
        break;
      case 'number':
        correctOption.number = target.number;
        // Ensure different color and shape
        const otherColors2 = colors.filter(c => c !== target.color);
        const otherShapes2 = shapes.filter(s => s !== target.shape);
        correctOption.color = otherColors2[Math.floor(Math.random() * otherColors2.length)];
        correctOption.shape = otherShapes2[Math.floor(Math.random() * otherShapes2.length)];
        break;
    }
    
    const options: CardData[] = [correctOption];
    
    // Create two distractor options that don't match target on any dimension
    for (let i = 0; i < 2; i++) {
      let distractor: CardData;
      let attempts = 0;
      
      do {
        distractor = generateCard();
        attempts++;
      } while (
        attempts < 100 && (
          // Distractor must not match target on any dimension
          distractor.color === target.color ||
          distractor.shape === target.shape ||
          distractor.number === target.number ||
          // Distractor must not be identical to any existing option
          options.some(opt => 
            opt.color === distractor.color && 
            opt.shape === distractor.shape && 
            opt.number === distractor.number
          )
        )
      );
      
      // Fallback if we couldn't generate a valid distractor
      if (attempts >= 100) {
        const availableColors = colors.filter(c => c !== target.color);
        const availableShapes = shapes.filter(s => s !== target.shape);
        const availableNumbers = numbers.filter(n => n !== target.number);
        
        distractor = {
          color: availableColors[i % availableColors.length],
          shape: availableShapes[i % availableShapes.length],
          number: availableNumbers[i % availableNumbers.length]
        };
      }
      
      options.push(distractor);
    }
    
    // Shuffle options
    const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.findIndex(opt => 
      (rule === 'shape' && opt.shape === target.shape && opt.color !== target.color && opt.number !== target.number) ||
      (rule === 'number' && opt.number === target.number && opt.color !== target.color && opt.shape !== target.shape)
    );
    
    return {
      target,
      options: shuffledOptions,
      correctIndex,
      rule
    };
  };

  // Initialize practice rule and first trial
  useEffect(() => {
    // Select either 'shape' or 'number' as the consistent practice rule
    const selectedRule: 'shape' | 'number' = Math.random() < 0.5 ? 'shape' : 'number';
    setPracticeRule(selectedRule);
    
    const trial = generatePracticeTrial(selectedRule);
    setCurrentTrial(trial);
    setTrialStartTime(Date.now());
    console.log('Generated Low Interference practice trial with consistent rule:', { 
      target: trial.target, 
      correctIndex: trial.correctIndex, 
      rule: selectedRule,
      correctOption: trial.options[trial.correctIndex]
    });
  }, []);

  const handleCardSelect = (cardIndex: number) => {
    if (showFeedback || !currentTrial || !practiceRule) return;
    
    setSelectedCard(cardIndex);
    const isCorrect = cardIndex === currentTrial.correctIndex;
    const responseTime = (Date.now() - trialStartTime) / 1000;
    
    // Determine practice phase
    let practicePhase: 'discovery' | 'confirmation' | 'incomplete';
    if (confirmationComplete) {
      practicePhase = 'confirmation';
    } else if (consecutiveCorrect >= 2) {
      practicePhase = 'confirmation';
    } else {
      practicePhase = 'discovery';
    }
    
    // Create trial data
    const newTrialData: PracticeTrialData = {
      trial_number: trialNumber,
      user_choice: `option_${cardIndex}`,
      correct: isCorrect,
      rule: practiceRule,
      response_time: responseTime,
      perseverative: false, // Not applicable in practice
      adaptation_latency: 0, // Not applicable in practice
      trial_type: 'practice',
      practice_phase: practicePhase,
      timestamp: Date.now()
    };
    
    setPracticeData(prev => [...prev, newTrialData]);
    setFeedbackType(isCorrect ? 'correct' : 'incorrect');
    setShowFeedback(true);
    
    // Update consecutive correct count
    if (isCorrect) {
      const newConsecutiveCorrect = consecutiveCorrect + 1;
      setConsecutiveCorrect(newConsecutiveCorrect);
      
      // Check if we should show confirmation trial
      if (newConsecutiveCorrect === 2 && !showConfirmation) {
        setShowConfirmation(true);
        console.log('User achieved 2 consecutive correct - confirmation trial will be next');
      } else if (showConfirmation && !confirmationComplete) {
        setConfirmationComplete(true);
        console.log('Confirmation trial completed successfully');
      }
    } else {
      setConsecutiveCorrect(0);
      setShowConfirmation(false); // Reset if they get one wrong
    }
    
    console.log(`Practice Trial ${trialNumber}: Correct=${isCorrect}, ConsecutiveCorrect=${isCorrect ? consecutiveCorrect + 1 : 0}, Rule=${practiceRule}`);
  };

  const handleNextTrial = () => {
    if (confirmationComplete || !practiceRule) {
      // Practice is complete, move to main assessment
      console.log('Practice completed with data:', practiceData);
      onNext();
      return;
    }
    
    // Generate next trial using the same consistent rule
    const trial = generatePracticeTrial(practiceRule);
    setCurrentTrial(trial);
    setSelectedCard(null);
    setShowFeedback(false);
    setFeedbackType(null);
    setTrialNumber(prev => prev + 1);
    setTrialStartTime(Date.now());
    
    console.log('Generated new Low Interference practice trial with consistent rule:', { 
      target: trial.target, 
      correctIndex: trial.correctIndex, 
      rule: practiceRule,
      correctOption: trial.options[trial.correctIndex]
    });
  };

  if (!currentTrial || !practiceRule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#149854] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading practice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-4xl mx-auto w-full">
        <Card className="shadow-lg border-0 bg-white">
          <CardContent className="p-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-normal text-gray-800 mb-6">Practice</h1>
              
              {/* Instruction Box */}
              <div className="bg-blue-gray-50 border border-blue-gray-200 rounded-xl p-6 mb-4 shadow-sm max-w-2xl mx-auto">
                <p className="text-lg text-gray-800 font-bold text-center mb-2">
                  Find the pattern matching the top card with one of the three cards below.
                </p>
                <p className="text-sm text-gray-600 text-center">
                  Try different options until you discover the rule.
                </p>
              </div>

              {/* Encouragement message for confirmation trial */}
              {showConfirmation && !confirmationComplete && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 max-w-2xl mx-auto">
                  <p className="text-green-800 text-base">
                    🎯 Nice! Let's confirm you got the pattern...
                  </p>
                </div>
              )}
            </div>

            {/* Game Area */}
            <div className="flex flex-col items-center space-y-10">
              {/* Target Card */}
              <div className="text-center">
                <p className="text-gray-600 mb-4 text-lg">Match this card:</p>
                <GameCard card={currentTrial.target} size="large" />
              </div>

              {/* Response Cards */}
              <div className="flex justify-center space-x-12">
                {currentTrial.options.map((card, index) => (
                  <div key={index} className="relative">
                    <GameCard
                      card={card}
                      onClick={() => handleCardSelect(index)}
                      isClickable={!showFeedback}
                      isSelected={selectedCard === index}
                      showFeedback={
                        showFeedback 
                          ? (index === currentTrial.correctIndex ? 'correct' : (selectedCard === index ? 'incorrect' : null))
                          : null
                      }
                      size="large"
                    />
                    {/* Feedback Icons */}
                    {showFeedback && index === currentTrial.correctIndex && (
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                    {showFeedback && selectedCard === index && index !== currentTrial.correctIndex && (
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">✗</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Feedback Section */}
              {showFeedback && !confirmationComplete && (
                <div className="text-center space-y-4">
                  {feedbackType === 'correct' ? (
                    <div className="space-y-4">
                      <p className="text-green-700 text-lg font-medium">
                        ✓ Correct! {consecutiveCorrect >= 2 ? 'Pattern confirmed!' : 'Keep going to confirm the pattern.'}
                      </p>
                      <Button 
                        onClick={handleNextTrial}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 text-base rounded-lg"
                      >
                        Continue
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-red-700 text-lg font-medium">
                        ✗ Try another card.
                      </p>
                      <Button 
                        onClick={handleNextTrial}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 text-base rounded-lg"
                      >
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Pattern Found Section */}
              {confirmationComplete && (
                <div className="text-center space-y-6 max-w-2xl">
                  <div className="space-y-4">
                    <p className="text-green-700 text-lg font-medium">
                      ✓ Excellent! You found the pattern.
                    </p>
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                      <p className="text-green-800 text-base">
                        Great work! You've mastered the practice round.
                      </p>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Button 
                      onClick={onNext}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg rounded-lg font-medium"
                    >
                      Start Flex Sort
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

export default PracticeTrials;
