import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import GameCard, { CardData } from './GameCard';
import { TrialData, AssessmentData } from '../pages/Index';

interface FlexSortTaskProps {
  onComplete: (data: AssessmentData) => void;
}

interface FlexSortTrial {
  target: CardData;
  options: CardData[];
  correctIndex: number;
  rule: 'color' | 'shape' | 'number';
  blockIndex: number;
}

const FlexSortTask = ({ onComplete }: FlexSortTaskProps) => {
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'incorrect' | null>(null);
  const [trials, setTrials] = useState<FlexSortTrial[]>([]);
  const [trialData, setTrialData] = useState<TrialData[]>([]);
  const [currentRule, setCurrentRule] = useState<'color' | 'shape' | 'number'>('color');
  const [trialStartTime, setTrialStartTime] = useState<number>(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [adaptationLatency, setAdaptationLatency] = useState(0);
  const [guidedModeTriggered, setGuidedModeTriggered] = useState(false);
  const [ruleTrainingTriggered, setRuleTrainingTriggered] = useState(false);
  const [extendedBlockTriggered, setExtendedBlockTriggered] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);

  // Enhanced state for better adaptive tracking
  const [blockErrorCounts, setBlockErrorCounts] = useState<{[blockIndex: number]: number}>({});
  const [firstCorrectInBlock, setFirstCorrectInBlock] = useState<{[blockIndex: number]: boolean}>({});
  const [initialRuleDiscoveryLatency, setInitialRuleDiscoveryLatency] = useState<number | null>(null);
  const [totalConsecutiveErrors, setTotalConsecutiveErrors] = useState(0); // Track all consecutive errors, not just perseverative
  const [currentBlockConsecutiveErrors, setCurrentBlockConsecutiveErrors] = useState(0); // Track consecutive errors within current block

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

  const generateTrial = (rule: 'color' | 'shape' | 'number', blockIndex: number): FlexSortTrial => {
    const target = generateCard();
    const options: CardData[] = [];
    
    // Create correct option that matches the target by the current rule
    const correctOption = { ...target };
    
    // Modify non-matching properties to ensure it's different but matches on the rule dimension
    const colors: CardData['color'][] = ['red', 'blue', 'green', 'yellow'];
    const shapes: CardData['shape'][] = ['circle', 'square', 'triangle', 'diamond'];
    const numbers: CardData['number'][] = [1, 2, 3, 4];
    
    if (rule !== 'color') {
      const otherColors = colors.filter(c => c !== target.color);
      correctOption.color = otherColors[Math.floor(Math.random() * otherColors.length)];
    }
    if (rule !== 'shape') {
      const otherShapes = shapes.filter(s => s !== target.shape);
      correctOption.shape = otherShapes[Math.floor(Math.random() * otherShapes.length)];
    }
    if (rule !== 'number') {
      const otherNumbers = numbers.filter(n => n !== target.number);
      correctOption.number = otherNumbers[Math.floor(Math.random() * otherNumbers.length)];
    }
    
    options.push(correctOption);
    
    // Create two incorrect options that don't match on any dimension
    for (let i = 0; i < 2; i++) {
      let incorrectOption;
      let attempts = 0;
      
      do {
        incorrectOption = generateCard();
        attempts++;
      } while (
        attempts < 50 && ( // Prevent infinite loops
          (incorrectOption.color === target.color) ||
          (incorrectOption.shape === target.shape) ||
          (incorrectOption.number === target.number) ||
          options.some(opt => 
            opt.color === incorrectOption.color && 
            opt.shape === incorrectOption.shape && 
            opt.number === incorrectOption.number
          )
        )
      );
      
      // If we can't generate a completely non-matching card, at least ensure it doesn't match the rule
      if (attempts >= 50) {
        incorrectOption = generateCard();
        // Ensure it doesn't match on the current rule dimension
        if (rule === 'color' && incorrectOption.color === target.color) {
          const otherColors = colors.filter(c => c !== target.color);
          incorrectOption.color = otherColors[Math.floor(Math.random() * otherColors.length)];
        }
        if (rule === 'shape' && incorrectOption.shape === target.shape) {
          const otherShapes = shapes.filter(s => s !== target.shape);
          incorrectOption.shape = otherShapes[Math.floor(Math.random() * otherShapes.length)];
        }
        if (rule === 'number' && incorrectOption.number === target.number) {
          const otherNumbers = numbers.filter(n => n !== target.number);
          incorrectOption.number = otherNumbers[Math.floor(Math.random() * otherNumbers.length)];
        }
      }
      
      options.push(incorrectOption);
    }
    
    // Shuffle options
    const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.findIndex(opt => 
      opt.color === correctOption.color && 
      opt.shape === correctOption.shape && 
      opt.number === correctOption.number
    );
    
    return {
      target,
      options: shuffledOptions,
      correctIndex,
      rule,
      blockIndex
    };
  };

  useEffect(() => {
    const rules: ('color' | 'shape' | 'number')[] = ['color', 'shape', 'number'];
    const generatedTrials: FlexSortTrial[] = [];
    
    // Generate 36 core trials (6 blocks of 6 trials each)
    for (let block = 0; block < 6; block++) {
      const blockRule = rules[block % 3];
      for (let trial = 0; trial < 6; trial++) {
        generatedTrials.push(generateTrial(blockRule, block));
      }
    }
    
    setTrials(generatedTrials);
    setCurrentRule(generatedTrials[0]?.rule || 'color');
    setTrialStartTime(Date.now());
    
    // Initialize block tracking
    const initialBlockErrors: {[blockIndex: number]: number} = {};
    const initialFirstCorrect: {[blockIndex: number]: boolean} = {};
    for (let i = 0; i < 6; i++) {
      initialBlockErrors[i] = 0;
      initialFirstCorrect[i] = false;
    }
    setBlockErrorCounts(initialBlockErrors);
    setFirstCorrectInBlock(initialFirstCorrect);
    
    console.log('Generated trials structure:', generatedTrials.map(t => ({ rule: t.rule, block: t.blockIndex })));
  }, []);

  const currentTrial = trials[currentTrialIndex];
  const progress = Math.min((currentTrialIndex / Math.max(trials.length, 1)) * 100, 100);

  const handleCardSelect = (cardIndex: number) => {
    if (showFeedback || !currentTrial) return;
    
    setSelectedCard(cardIndex);
    const isCorrect = cardIndex === currentTrial.correctIndex;
    const responseTime = (Date.now() - trialStartTime) / 1000;
    
    // Calculate block and trial positions
    const currentBlockIdx = currentTrial.blockIndex;
    const trialInBlock = (currentTrialIndex % 6) + 1;
    const ruleBlockNumber = currentBlockIdx + 1;
    
    // Determine if this is a rule switch trial
    const isRuleSwitch = currentTrialIndex > 0 && 
      trials[currentTrialIndex - 1]?.rule !== currentTrial.rule;
    
    // Update block tracking
    if (currentBlockIdx !== currentBlockIndex) {
      setCurrentBlockIndex(currentBlockIdx);
      setCurrentBlockConsecutiveErrors(0); // Reset block consecutive errors when entering new block
    }
    
    // Enhanced consecutive error tracking
    let newConsecutiveErrors = consecutiveErrors;
    let newTotalConsecutiveErrors = totalConsecutiveErrors;
    let newCurrentBlockConsecutiveErrors = currentBlockConsecutiveErrors;
    
    if (!isCorrect) {
      newConsecutiveErrors = consecutiveErrors + 1;
      newTotalConsecutiveErrors = totalConsecutiveErrors + 1;
      newCurrentBlockConsecutiveErrors = currentBlockConsecutiveErrors + 1;
      
      setConsecutiveErrors(newConsecutiveErrors);
      setTotalConsecutiveErrors(newTotalConsecutiveErrors);
      setCurrentBlockConsecutiveErrors(newCurrentBlockConsecutiveErrors);
      
      // Update block error count
      setBlockErrorCounts(prev => ({
        ...prev,
        [currentBlockIdx]: (prev[currentBlockIdx] || 0) + 1
      }));
    } else {
      // Reset consecutive error counters on correct response
      newConsecutiveErrors = 0;
      newTotalConsecutiveErrors = 0;
      newCurrentBlockConsecutiveErrors = 0;
      
      setConsecutiveErrors(0);
      setTotalConsecutiveErrors(0);
      setCurrentBlockConsecutiveErrors(0);
      
      // Mark first correct in block
      if (!firstCorrectInBlock[currentBlockIdx]) {
        setFirstCorrectInBlock(prev => ({
          ...prev,
          [currentBlockIdx]: true
        }));
        
        // For Block 1 (index 0), record initial rule discovery latency
        if (currentBlockIdx === 0 && initialRuleDiscoveryLatency === null) {
          setInitialRuleDiscoveryLatency(currentTrialIndex + 1);
          console.log(`Initial rule discovery latency: ${currentTrialIndex + 1} trials`);
        }
      }
    }
    
    // Fixed Adaptation Latency Calculation
    let currentAdaptationLatency: number | null = null;
    let currentInitialDiscovery: number | null = null;
    
    if (currentBlockIdx === 0) {
      // Block 1: track initial rule discovery
      currentInitialDiscovery = initialRuleDiscoveryLatency;
      currentAdaptationLatency = null;
    } else {
      // Blocks 2-6: adaptation latency is the number of errors made in this block so far
      currentAdaptationLatency = blockErrorCounts[currentBlockIdx] + (isCorrect ? 0 : 1);
    }
    
    // Update global adaptation latency for triggering adaptive features
    if (currentAdaptationLatency !== null) {
      setAdaptationLatency(currentAdaptationLatency);
    }
    
    // Improved perseverative error detection
    let isPerseverative = false;
    if (!isCorrect && trialData.length > 0) {
      // Check if we're in a new rule block and user is still applying old rule logic
      const previousRule = trialData[trialData.length - 1]?.rule;
      const isNewRuleBlock = currentTrial.rule !== previousRule;
      
      if (isNewRuleBlock) {
        // Count as perseverative if user has made 2+ errors in this new rule block
        const currentBlockTrials = trialData.filter(t => t.rule_block_number === ruleBlockNumber);
        const recentErrors = currentBlockTrials.filter(t => !t.correct).length;
        isPerseverative = recentErrors >= 1;
      }
    }
    
    // Create enhanced trial data with fixed behavioral metrics
    const newTrialData: TrialData = {
      trial_number: currentTrialIndex + 1,
      user_choice: `option_${cardIndex}`,
      correct: isCorrect,
      rule: currentTrial.rule,
      response_time: responseTime,
      perseverative: isPerseverative,
      adaptation_latency: currentAdaptationLatency,
      trial_type: 'core',
      timestamp: Date.now(),
      initial_rule_discovery_latency: currentInitialDiscovery,
      rule_switch: isRuleSwitch,
      consecutive_errors: newConsecutiveErrors,
      trial_in_block: trialInBlock,
      rule_block_number: ruleBlockNumber
    };
    
    setTrialData(prev => [...prev, newTrialData]);
    setFeedbackType(isCorrect ? 'correct' : 'incorrect');
    setShowFeedback(true);
    
    // Fixed Adaptive Triggers - now based on real consecutive errors and adaptation latency
    if (newConsecutiveErrors >= 4 && !extendedBlockTriggered) {
      setExtendedBlockTriggered(true);
      console.log('Extended block triggered due to consecutive errors:', newConsecutiveErrors);
    }
    
    // Guided mode should trigger based on consecutive errors OR slow adaptation
    if ((newConsecutiveErrors >= 3 || (currentAdaptationLatency !== null && currentAdaptationLatency >= 4)) && !guidedModeTriggered) {
      setGuidedModeTriggered(true);
      console.log('Guided mode triggered - consecutive errors:', newConsecutiveErrors, 'adaptation latency:', currentAdaptationLatency);
    }
    
    // Rule training trigger - for very poor adaptation
    if ((newConsecutiveErrors >= 5 || (currentAdaptationLatency !== null && currentAdaptationLatency >= 6)) && !ruleTrainingTriggered) {
      setRuleTrainingTriggered(true);
      console.log('Rule training triggered - consecutive errors:', newConsecutiveErrors, 'adaptation latency:', currentAdaptationLatency);
    }
    
    console.log(`Trial ${currentTrialIndex + 1}: Rule=${currentTrial.rule}, Block=${ruleBlockNumber}, Correct=${isCorrect}, ConsecutiveErrors=${newConsecutiveErrors}, BlockConsecutiveErrors=${newCurrentBlockConsecutiveErrors}, AdaptationLatency=${currentAdaptationLatency}, GuidedMode=${guidedModeTriggered}, RuleTraining=${ruleTrainingTriggered}`);
  };

  const handleNextTrial = () => {
    if (currentTrialIndex < trials.length - 1) {
      setCurrentTrialIndex(currentTrialIndex + 1);
      setSelectedCard(null);
      setShowFeedback(false);
      setFeedbackType(null);
      setTrialStartTime(Date.now());
    } else {
      // Complete assessment
      completeAssessment();
    }
  };

  const completeAssessment = () => {
    console.log('Completing assessment with enhanced trial data:', trialData);
    
    const totalTrials = trialData.length;
    const correctTrials = trialData.filter(t => t.correct).length;
    const perseverativeErrors = trialData.filter(t => t.perseverative).length;
    const avgResponseTime = trialData.reduce((sum, t) => sum + t.response_time, 0) / totalTrials;
    
    // Enhanced shifts calculation with new metrics
    let shiftsAchieved = 0;
    const blocks = [
      { start: 0, end: 5, rule: 'color' },
      { start: 6, end: 11, rule: 'shape' },
      { start: 12, end: 17, rule: 'number' },
      { start: 18, end: 23, rule: 'color' },
      { start: 24, end: 29, rule: 'shape' },
      { start: 30, end: 35, rule: 'number' }
    ];
    
    // Count successful rule shifts using adaptation latency data
    for (let i = 1; i < blocks.length; i++) {
      const blockStart = blocks[i].start;
      const blockTrials = trialData.slice(blockStart, blockStart + 3);
      
      // Shift is successful if user gets at least 2 out of first 3 trials correct
      const correctInBlock = blockTrials.filter(t => t.correct).length;
      if (correctInBlock >= 2) {
        shiftsAchieved++;
        console.log(`Shift ${i} achieved: ${blocks[i-1].rule} -> ${blocks[i].rule}`);
      } else {
        console.log(`Shift ${i} failed: ${blocks[i-1].rule} -> ${blocks[i].rule}, only ${correctInBlock}/3 correct`);
      }
    }
    
    // Fixed cognitive flexibility score calculation
    const accuracyScore = (correctTrials / totalTrials) * 100;
    const shiftScore = (shiftsAchieved / 5) * 100; // 5 possible shifts
    
    // Fixed Error Control calculation - now based on actual consecutive errors, not just perseverative
    const totalErrors = totalTrials - correctTrials;
    const errorControlScore = Math.max(0, 100 - (totalErrors / totalTrials) * 100);
    
    // Weight the scores - give more weight to accuracy for perfect performers
    let flexibilityScore;
    if (correctTrials === totalTrials) {
      // Perfect accuracy deserves high flexibility score
      flexibilityScore = Math.max(90, (accuracyScore * 0.6) + (shiftScore * 0.3) + (errorControlScore * 0.1));
    } else {
      // Standard weighted calculation
      flexibilityScore = (accuracyScore * 0.4) + (shiftScore * 0.4) + (errorControlScore * 0.2);
    }
    
    console.log('Fixed scoring breakdown:', {
      correctTrials,
      totalTrials,
      totalErrors,
      accuracyScore,
      shiftsAchieved,
      shiftScore,
      perseverativeErrors,
      errorControlScore,
      finalScore: Math.round(flexibilityScore),
      guidedModeTriggered,
      ruleTrainingTriggered,
      maxConsecutiveErrors: Math.max(...trialData.map(t => t.consecutive_errors))
    });
    
    const assessmentData: AssessmentData = {
      trials: trialData,
      cognitive_flexibility_score: Math.round(flexibilityScore),
      shifts_achieved: shiftsAchieved,
      perseverative_errors: perseverativeErrors,
      adaptation_latency: adaptationLatency,
      avg_response_time: avgResponseTime,
      guided_mode_triggered: guidedModeTriggered,
      rule_training_triggered: ruleTrainingTriggered,
      completed_at: new Date().toISOString()
    };
    
    console.log('Enhanced behavioral metrics summary:', {
      initialRuleDiscovery: initialRuleDiscoveryLatency,
      blockAdaptations: Object.keys(blockErrorCounts).map(block => ({
        block: parseInt(block) + 1,
        errorsBeforeSuccess: blockErrorCounts[parseInt(block)]
      })),
      ruleSwitchTrials: trialData.filter(t => t.rule_switch).length,
      maxConsecutiveErrors: Math.max(...trialData.map(t => t.consecutive_errors)),
      adaptiveFeatures: {
        guidedMode: guidedModeTriggered,
        ruleTraining: ruleTrainingTriggered,
        extendedBlock: extendedBlockTriggered
      }
    });
    
    onComplete(assessmentData);
  };

  if (!currentTrial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#149854] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="max-w-4xl mx-auto w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Flex Sort Assessment</span>
            <span className="text-sm text-gray-600">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-200" />
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-8">
            {/* Enhanced Adaptive Mode Indicators */}
            {(guidedModeTriggered || extendedBlockTriggered || ruleTrainingTriggered) && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {guidedModeTriggered && "🎯 Guided mode active - take your time"}
                  {extendedBlockTriggered && " ⏱️ Extended practice block"}
                  {ruleTrainingTriggered && " 📚 Rule training mode active"}
                </p>
              </div>
            )}

            {/* Game Area */}
            <div className="flex flex-col items-center space-y-8">
              {/* Target Card - Use large size to match demo/practice */}
              <div className="text-center">
                <p className="text-gray-600 mb-4 text-lg">Match this card:</p>
                <GameCard card={currentTrial.target} size="large" />
              </div>

              {/* Response Cards - Use large size and proper spacing to match demo/practice */}
              <div className="text-center">
                <p className="text-gray-600 mb-4 text-lg">Choose the best match:</p>
                <div className="flex justify-center space-x-12">
                  {currentTrial.options.map((card, index) => (
                    <GameCard
                      key={index}
                      card={card}
                      onClick={() => handleCardSelect(index)}
                      isClickable={!showFeedback}
                      isSelected={selectedCard === index}
                      showFeedback={
                        showFeedback && selectedCard === index 
                          ? feedbackType 
                          : null
                      }
                      size="large"
                    />
                  ))}
                </div>
              </div>

              {/* Feedback */}
              {showFeedback && (
                <div className="text-center space-y-4">
                  {feedbackType === 'correct' ? (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                      <p className="text-green-800 font-medium">✓ Correct!</p>
                    </div>
                  ) : (
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                      <p className="text-red-800 font-medium">✗ Incorrect</p>
                    </div>
                  )}

                  <button
                    onClick={handleNextTrial}
                    className="bg-[#149854] hover:bg-[#0f7a42] text-white px-6 py-2 rounded-lg transition-colors duration-200"
                  >
                    {currentTrialIndex < trials.length - 1 ? 'Next Trial' : 'Complete Assessment'}
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FlexSortTask;
