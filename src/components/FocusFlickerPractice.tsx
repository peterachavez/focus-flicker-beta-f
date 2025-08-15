import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import GameCard, { CardData } from './GameCard';

type FocusFlickerPracticeProps = { onNext: () => void };

export default function FocusFlickerPractice({ onNext }: FocusFlickerPracticeProps) {
  interface FlickerTrial { base: CardData; altered: CardData; hasChange: boolean }

  const colors: CardData['color'][] = ['red','blue','green','yellow'];
  const shapes: CardData['shape'][] = ['circle','square','triangle','diamond'];
  const numbers: CardData['number'][] = [1,2,3,4];

  const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random()*arr.length)];
  const genCard = (): CardData => ({ color: rand(colors), shape: rand(shapes), number: rand(numbers) });

  const createTrial = (): FlickerTrial => {
    const base = genCard();
    const shouldChange = Math.random() < 0.5;
    if (!shouldChange) return { base, altered: { ...base }, hasChange: false };
    const dim = Math.floor(Math.random()*3);
    const altered: CardData = { ...base };
    if (dim === 0) altered.color = rand(colors.filter(c=>c!==base.color));
    if (dim === 1) altered.shape = rand(shapes.filter(s=>s!==base.shape));
    if (dim === 2) altered.number = rand(numbers.filter(n=>n!==base.number)) as CardData['number'];
    return { base, altered, hasChange: true };
  };

  // state
  const [trial, setTrial] = useState<FlickerTrial>(createTrial());
  const [showAltered, setShowAltered] = useState(false);
  const [displayMs, setDisplayMs] = useState(800);
  const [hasResponded, setHasResponded] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);
  const [trialNumber, setTrialNumber] = useState(1);

  const MIN_MS = 200, MAX_MS = 1000;

  // flicker
  useEffect(() => {
    const id = setInterval(() => setShowAltered(v=>!v), displayMs);
    return () => clearInterval(id);
  }, [displayMs, trial]);

  const handleResponse = (choice: 'change' | 'nochange') => {
    if (hasResponded) return;
    const correct = (choice === 'change' && trial.hasChange) || (choice === 'nochange' && !trial.hasChange);
    setIsCorrect(correct);
    setHasResponded(true);

    if (correct) {
      setDisplayMs(ms => Math.max(MIN_MS, ms - 100));
      setStreak(prev => {
        const next = prev + 1;
        // auto-advance immediately when streak hits 3 (no completion screen)
        if (next >= 3) {
          setTimeout(() => onNext(), 600);
        }
        return next;
      });
    } else {
      setDisplayMs(ms => Math.min(MAX_MS, ms + 100));
      setStreak(0);
    }

    // brief feedback, then new practice trial (unless onNext already fired)
    setTimeout(() => {
      setHasResponded(false);
      setIsCorrect(null);
      setShowAltered(false);
      setTrial(createTrial());
      setTrialNumber(n => n + 1);
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-3xl mx-auto w-full">
        {/* streak progress (matches Flex Sort bar styling) */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Practice</span>
            <span className="text-sm text-gray-600">Streak: {streak} / 3</span>
          </div>
          <Progress value={(streak / 3) * 100} className="h-2 bg-gray-200" />
        </div>

        <Card className="shadow-lg border-0 bg-white">
          <CardContent className="p-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-normal text-gray-800 mb-6">Practice</h1>
              <div className="text-gray-600 text-base max-w-xl mx-auto">
                Decide whether a change occurred. The speed may adjust as you go.
              </div>
            </div>

            <div className="flex flex-col items-center space-y-10">
              <div className="text-center">
                <GameCard card={showAltered ? trial.altered : trial.base} size="large" />
              </div>

              {!hasResponded && (
                <div className="flex justify-center space-x-12">
                  <Button onClick={() => handleResponse('change')} className="bg-[#149854] hover:bg-[#0f7a42] text-white px-6 py-3 text-lg font-medium rounded-lg">
                    Change
                  </Button>
                  <Button onClick={() => handleResponse('nochange')} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 text-lg font-medium rounded-lg">
                    No Change
                  </Button>
                </div>
              )}

              {hasResponded && (
                <div className="text-center">
                  {isCorrect ? (
                    <p className="text-green-700 text-lg font-medium">✓ Correct!</p>
                  ) : (
                    <p className="text-red-700 text-lg font-medium">✗ Incorrect.</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
