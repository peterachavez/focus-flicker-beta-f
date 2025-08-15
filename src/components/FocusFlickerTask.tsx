import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import GameCard, { CardData } from './GameCard';
import { TrialData, AssessmentData } from '../pages/Index';

interface FocusFlickerTaskProps {
  /**
   * Called when all trials are complete.  The resulting AssessmentData
   * contains flicker‑specific metrics encoded into the same structure used
   * by the Flex Sort task so downstream screens remain agnostic to the
   * underlying paradigm.  A `task` property is added by Index.tsx when
   * storing results.
   */
  onComplete: (data: AssessmentData) => void;
}

interface FlickerTrial {
  base: CardData;
  altered: CardData;
  hasChange: boolean;
  blockIndex: number;
}

/**
 * Main engine for the Focus Flicker assessment.  Participants view a
 * flickering card and decide whether a change occurred.  The flicker speed
 * adapts based on performance.  Hits, false alarms and response times
 * are recorded.  At completion, results are summarized into an
 * AssessmentData object.
 */
const FocusFlickerTask = ({ onComplete }: FocusFlickerTaskProps) => {
  /**
   * Generate a random card.  We reuse the color/shape/number values from
   * Flex Sort to provide a consistent visual vocabulary.  This function
   * returns one of four colors, four shapes and four numbers.
   */
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

  /**
   * Generate the full set of trials.  We create six blocks of six trials
   * each (36 trials total) to parallel the Flex Sort structure.  Within
   * each block half of the trials contain a change and half do not.  The
   * order of trials within each block is shuffled.
   */
  const generateTrials = (): FlickerTrial[] => {
    const allTrials: FlickerTrial[] = [];
    for (let block = 0; block < 6; block++) {
      const blockTrials: FlickerTrial[] = [];
      // In each block generate 3 change trials and 3 no‑change trials
      for (let i = 0; i < 3; i++) {
        const base = generateCard();
        // Create an altered card by changing exactly one dimension
        const altered: CardData = { ...base };
        const dim = Math.floor(Math.random() * 3);
        if (dim === 0) {
          const colors: CardData['color'][] = ['red', 'blue', 'green', 'yellow'];
          altered.color = colors.filter(c => c !== base.color)[Math.floor(Math.random() * 3)];
        } else if (dim === 1) {
          const shapes: CardData['shape'][] = ['circle', 'square', 'triangle', 'diamond'];
          altered.shape = shapes.filter(s => s !== base.shape)[Math.floor(Math.random() * 3)];
        } else {
          const numbers: CardData['number'][] = [1, 2, 3, 4];
          altered.number = numbers.filter(n => n !== base.number)[Math.floor(Math.random() * 3)] as CardData['number'];
        }
        blockTrials.push({ base, altered, hasChange: true, blockIndex: block });
      }
      for (let i = 0; i < 3; i++) {
        const base = generateCard();
        const altered = { ...base };
        blockTrials.push({ base, altered, hasChange: false, blockIndex: block });
      }
      // Shuffle the six trials in this block
      blockTrials.sort(() => Math.random() - 0.5);
      allTrials.push(...blockTrials);
    }
    return allTrials;
  };

  // State for trials and indices
  const [trials] = useState<FlickerTrial[]>(generateTrials());
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [showAltered, setShowAltered] = useState(false);
  const [displayMs, setDisplayMs] = useState(800); // Starting flicker speed
  const minDisplayMs = 200;
  const maxDisplayMs = 1000;
  const stepMs = 100;
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [hasResponded, setHasResponded] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  // Metrics accumulation
  const [hits, setHits] = useState(0);
  const [falseAlarms, setFalseAlarms] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [guidedModeTriggered, setGuidedModeTriggered] = useState(false);

  // When the participant accumulates multiple consecutive errors the task
  // enters a guided mode.  In guided mode we pause the flicker stream and
  // present an explicit side‑by‑side comparison of the base and altered
  // images along with supportive text.  The participant must click to
  // continue to resume the assessment.  This flag controls whether the
  // overlay is currently shown.
  const [inGuidedMode, setInGuidedMode] = useState(false);

  // Flicker interval.  Restart whenever the trial index or display speed
  // changes.  Clear interval on unmount.
  useEffect(() => {
    const interval = setInterval(() => {
      setShowAltered(prev => !prev);
    }, displayMs);
    return () => clearInterval(interval);
  }, [currentTrialIndex, displayMs]);

  // Start the timer when the component mounts or when moving to a new trial
  useEffect(() => {
    setTrialStartTime(Date.now());
  }, [currentTrialIndex]);

  const currentTrial = trials[currentTrialIndex];
  const progress = (currentTrialIndex / trials.length) * 100;

  const handleResponse = (choice: 'change' | 'nochange') => {
    if (hasResponded) return;
    const rt = (Date.now() - trialStartTime) / 1000; // seconds
    const isCorrect = (choice === 'change' && currentTrial.hasChange) || (choice === 'nochange' && !currentTrial.hasChange);
    const isFalseAlarm = choice === 'change' && !currentTrial.hasChange;

    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setHasResponded(true);
    setResponseTimes(prev => [...prev, rt]);

    // Update hits/false alarms
    if (currentTrial.hasChange && isCorrect) {
      setHits(h => h + 1);
      setConsecutiveErrors(0);
      // Speed up when participant is correct on a change trial
      setDisplayMs(ms => Math.max(minDisplayMs, ms - stepMs));
    } else if (!currentTrial.hasChange && isCorrect) {
      // Correct rejection: speed up slightly as well
      setConsecutiveErrors(0);
      setDisplayMs(ms => Math.max(minDisplayMs, ms - stepMs));
    } else {
      // Incorrect: either miss (change & said nochange) or false alarm (nochange & said change)
      if (isFalseAlarm) {
        setFalseAlarms(f => f + 1);
      }
      setConsecutiveErrors(c => c + 1);
      // Slow down to make detection easier
      setDisplayMs(ms => Math.min(maxDisplayMs, ms + stepMs));
      // Trigger guided mode if participant is struggling repeatedly
      if (consecutiveErrors + 1 >= 3) {
        setGuidedModeTriggered(true);
      }
    }

    // Determine the next consecutive error count.  Correct responses reset
    // the streak while incorrect responses increment it.  We compute this
    // before updating state so we can decide whether to trigger guided mode.
    const nextConsecutiveErrors = isCorrect ? 0 : consecutiveErrors + 1;

    // Prepare TrialData entry for this trial
    const trialData: TrialData = {
      trial_number: currentTrialIndex + 1,
      user_choice: choice,
      correct: isCorrect,
      rule: 'flicker',
      response_time: rt,
      perseverative: isFalseAlarm,
      adaptation_latency: 0,
      trial_type: 'core',
      timestamp: Date.now(),
      initial_rule_discovery_latency: 0,
      rule_switch: false,
      consecutive_errors: nextConsecutiveErrors,
      trial_in_block: (currentTrialIndex % 6) + 1,
      rule_block_number: currentTrial.blockIndex + 1,
      change_occurred: currentTrial.hasChange,
      display_ms: displayMs,
    };
    setTrialData(prev => [...prev, trialData]);

    // Decide whether to enter guided mode.  We trigger guided mode when
    // there are three or more consecutive errors and it hasn’t been
    // activated already.  Guided mode will pause the assessment and
    // present a side‑by‑side comparison.
    const triggerGuided = nextConsecutiveErrors >= 3 && !guidedModeTriggered;

    // Schedule the next step after feedback delay.  If guided mode is
    // triggered we avoid automatically advancing the trial; instead the
    // overlay will handle progression.  Otherwise we advance as usual or
    // finish the assessment when all trials are complete.
    setTimeout(() => {
      setHasResponded(false);
      setFeedback(null);
      setShowAltered(false);

      if (triggerGuided) {
        // Activate guided mode overlay.  We reset the consecutive error
        // counter and slow down the flicker to the maximum duration to
        // provide a gentler re‑entry after guidance.
        setGuidedModeTriggered(true);
        setConsecutiveErrors(0);
        setDisplayMs(maxDisplayMs);
        setInGuidedMode(true);
      } else {
        // Normal progression: advance to the next trial or finish.
        if (currentTrialIndex + 1 >= trials.length) {
          finishAssessment([...trialDataAccum, trialData]);
        } else {
          setCurrentTrialIndex(idx => idx + 1);
        }
        // Reset consecutive error streak if the response was correct
        setConsecutiveErrors(nextConsecutiveErrors);
      }
    }, 800);
  };

  // Local accumulator for trial data.  We update this outside of state to avoid
  // stale closures inside handleResponse.  Each handleResponse call will
  // push its TrialData into this array before the final onComplete call.
  const [trialDataAccum, setTrialData] = useState<TrialData[]>([]);

  const finishAssessment = (allTrialData: TrialData[]) => {
    const totalTrials = allTrialData.length;
    const avgRT = allTrialData.reduce((sum, t) => sum + t.response_time, 0) / totalTrials;
    // Convert final displayMs to a score out of 100.  A lower displayMs
    // (faster flicker) yields a higher score.  When displayMs == min
    // we give 100; when displayMs == max we give 0.
    const thresholdScore = Math.round(
      ((maxDisplayMs - displayMs) / (maxDisplayMs - minDisplayMs)) * 100
    );
    // Compute an attention score by combining detection sensitivity (threshold)
    // with hit and false alarm rates.  Hits increase the score, false alarms
    // decrease it.  We normalise hits and false alarms by total trials to
    // maintain comparability across sessions.  This formula can be tuned
    // based on domain expertise but provides a reasonable starting point.
    // correct denominators
      const changeTrials = allTrialData.filter(t => t.change_occurred).length;
      const noChangeTrials = allTrialData.filter(t => !t.change_occurred).length;
      const hitRate = changeTrials > 0 ? hits / changeTrials : 0;            // hits over CHANGE trials
      const falseAlarmRate = noChangeTrials > 0 ? falseAlarms / noChangeTrials : 0;  // FAs over NO-CHANGE trials

    // Weighted average: emphasise threshold (50%), hit rate (30%) and
    // error control (20%).  Error control is (1 - falseAlarmRate).
    const attentionScoreRaw =
      0.5 * (thresholdScore / 100) +
      0.3 * hitRate +
      0.2 * (1 - falseAlarmRate);
    const attentionScore = Math.round(attentionScoreRaw * 100);
    const assessment: AssessmentData = {
      trials: allTrialData,
      cognitive_flexibility_score: thresholdScore,
      shifts_achieved: hits,
      perseverative_errors: falseAlarms,
      adaptation_latency: 0,
      avg_response_time: avgRT,
      guided_mode_triggered: guidedModeTriggered,
      rule_training_triggered: false,
      completed_at: new Date().toISOString(),
      attention_score: attentionScore,
    };
    onComplete(assessment);
  };
  // Render either the guided mode overlay or the standard assessment UI.
  if (inGuidedMode) {
    // We reuse the current trial indices to display the base and altered
    // images side‑by‑side.  If we’ve reached the end of the trials we
    // gracefully fall back to empty cards to avoid undefined errors.
    const baseCard = currentTrial?.base || { color: 'red', shape: 'circle', number: 1 };
    const alteredCard = currentTrial?.altered || { color: 'blue', shape: 'square', number: 1 };
    const handleGuidedContinue = () => {
      setInGuidedMode(false);
      // After leaving guided mode either advance to the next trial or
      // complete the assessment.  Resetting the consecutive error count
      // prevents immediate re‑entry into guided mode on the next trial.
      if (currentTrialIndex + 1 >= trials.length) {
        finishAssessment(trialDataAccum);
      } else {
        setCurrentTrialIndex(idx => idx + 1);
      }
    };
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
        <div className="max-w-3xl mx-auto w-full">
          <Card className="shadow-lg border-0 bg-white">
            <CardContent className="p-12">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-normal text-gray-800 mb-4">Guided Mode</h1>
                <p className="text-gray-600 text-base max-w-xl mx-auto">
                  You seem to be having difficulty detecting the change.  The card below
                  alternates between two images: the left shows the original and the
                  right shows the changed version.  Study the difference and click
                  Continue when you’re ready to resume.
                </p>
              </div>
              <div className="flex justify-center space-x-8 mb-8">
                <div className="text-center">
                  <p className="text-gray-600 mb-2 text-sm">Original</p>
                  <GameCard card={baseCard} size="large" />
                </div>
                <div className="text-center">
                  <p className="text-gray-600 mb-2 text-sm">Changed</p>
                  <GameCard card={alteredCard} size="large" />
                </div>
              </div>
              <div className="text-center">
                <Button
                  onClick={handleGuidedContinue}
                  className="bg-[#149854] hover:bg-[#0f7a42] text-white px-8 py-3 text-lg font-medium rounded-lg"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-4xl mx-auto w-full">
        {/* Progress Bar with labels matching Flex Sort styling */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Focus Flicker Assessment</span>
            <span className="text-sm text-gray-600">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-200" />
        </div>
        <Card className="shadow-lg border-0 bg-white">
          <CardContent className="p-12">
            {/* Enhanced Adaptive Mode Indicators */}
            {(guidedModeTriggered) && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  🎯 Guided mode active - take your time
                </p>
              </div>
            )}
            {/* Game Area */}
            <div className="flex flex-col items-center space-y-10">
              <div className="text-center">
                <GameCard card={showAltered ? currentTrial.altered : currentTrial.base} size="large" />
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
              {/* Feedback Message */}
              {hasResponded && feedback && (
                <div className="text-center space-y-4">
                  {feedback === 'correct' ? (
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
};

export default FocusFlickerTask;