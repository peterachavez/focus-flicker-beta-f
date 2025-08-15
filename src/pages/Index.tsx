import React from 'react';
import WelcomeScreen from '../components/WelcomeScreen';
import ConsentScreen from '../components/ConsentScreen';
import PostAssessment from '../components/PostAssessment';
import PricingTiers from '../components/PricingTiers';
import PaymentVerificationWrapper from '../components/PaymentVerificationWrapper';
// Imports for the Focus Flicker task
import FocusFlickerInstructions from '../components/FocusFlickerInstructions';
import FocusFlickerDemo from '../components/FocusFlickerDemo';
import FocusFlickerPractice from '../components/FocusFlickerPractice';
import FocusFlickerTask from '../components/FocusFlickerTask';

export type AppPhase =
  | 'welcome'
  | 'consent'
  | 'instructions'
  | 'demo'
  | 'practice'
  | 'focusflicker'
  | 'post-assessment'
  | 'pricing'
  | 'results';

// The current task determines which set of instructions, practice,
// demonstration and main engine to render.  Flex Sort remains the default.
// Only Focus Flicker is available as a task
export type TaskType = 'focusFlicker';

export interface TrialData {
  trial_number: number;
  user_choice: string;
  correct: boolean;
  /**
   * The sorting rule for Flex Sort.  For Focus Flicker this value is
   * always set to 'flicker' so the results dashboard can distinguish
   * between paradigms without misinterpreting the data.  Keeping the
   * property optional allows backwards compatibility with legacy
   * assessments that only provide the three classic rule values.
   */
  rule: 'color' | 'shape' | 'number' | 'flicker';
  response_time: number;
  perseverative: boolean;
  adaptation_latency: number | null;
  trial_type: 'core' | 'buffer' | 'guided' | 'extended' | 'demo' | 'practice';
  timestamp: number;
  initial_rule_discovery_latency: number | null;
  rule_switch: boolean;
  consecutive_errors: number;
  trial_in_block: number;
  rule_block_number: number;

    /**
     * Indicates whether a change occurred on the current Focus Flicker trial.
     * For Flex Sort this will be undefined.  Including this flag in the
     * exported CSV helps researchers quickly filter hits, misses and false
     * alarms when analysing flicker data.
     */
    change_occurred?: boolean;

    /**
     * The display duration (in milliseconds) used on the current trial.
     * Capturing the flicker speed at each step allows nuanced analysis of
     * adaptive pacing.  This field is only populated for Focus Flicker
     * assessments.
     */
    display_ms?: number;
}

export interface AssessmentData {
  trials: TrialData[];
  cognitive_flexibility_score: number;
  shifts_achieved: number;
  perseverative_errors: number;
  adaptation_latency: number;
  avg_response_time: number;
  guided_mode_triggered: boolean;
  rule_training_triggered: boolean;
  completed_at: string;

    /**
     * Overall attention score calculated for Focus Flicker assessments.  This
     * value is scaled from 0–100 where higher scores reflect the ability to
     * detect rapid changes at higher flicker frequencies.  For legacy
     * Flex Sort assessments this property will be undefined.
     */
    attention_score?: number;
}

const STORAGE_KEYS = {
  assessmentData: 'assessment_data',
  assessmentId: 'current_assessment_id',
  selectedTier: 'selected_tier',
};

// small, dependency-free id
const genId = () =>
  `fs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const Index = () => {
  const [currentPhase, setCurrentPhase] = React.useState<AppPhase>('welcome');
  // Only one task is available so default and constant
  const [currentTask, setCurrentTask] = React.useState<TaskType>('focusFlicker');
  const [assessmentData, setAssessmentData] = React.useState<AssessmentData>({
    trials: [],
    cognitive_flexibility_score: 0,
    shifts_achieved: 0,
    perseverative_errors: 0,
    adaptation_latency: 0,
    avg_response_time: 0,
    guided_mode_triggered: false,
    rule_training_triggered: false,
    completed_at: '',
  });
  const [selectedTier, setSelectedTier] = React.useState<string>('free');
  const [sessionId, setSessionId] = React.useState<string>('');

  function handlePhaseTransition(nextPhase: AppPhase) {
    return setCurrentPhase(nextPhase);
  }

  // When assessment completes, persist results + an assessment_id
  const handleAssessmentComplete = (data: AssessmentData | (AssessmentData & { task?: string })) => {
    const existingId = localStorage.getItem(STORAGE_KEYS.assessmentId);
    const assessmentId = existingId || genId();

    // Tag the assessment with the current task so downstream components can
    // tailor messaging.  This is a no‑op for Flex Sort where the engine
    // doesn’t attach a task field.
    const tagged = { ...data, task: (data as any).task || currentTask } as any;

    localStorage.setItem(STORAGE_KEYS.assessmentId, assessmentId);
    localStorage.setItem(STORAGE_KEYS.assessmentData, JSON.stringify(tagged));

    setAssessmentData(tagged);
    setCurrentPhase('post-assessment');
  };

  // Pricing tier selected (for Free flow) – but for paid flow we still persist tier
  const handleTierSelection = (tier: string) => {
    setSelectedTier(tier);
    localStorage.setItem(STORAGE_KEYS.selectedTier, tier);
    setCurrentPhase('results');
  };

  // On first mount:
  // 1) If we’re returning from Stripe (?checkout=success), recover params and local state.
  // 2) Otherwise, reload any locally stored assessment data so refresh doesn't lose results.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const tierParam = params.get('tier');
    const sid = params.get('session_id');

    // Always try to hydrate from localStorage (covers both fresh return & plain refresh)
    const savedDataRaw = localStorage.getItem(STORAGE_KEYS.assessmentData);
    if (savedDataRaw) {
      try {
        const parsed: AssessmentData = JSON.parse(savedDataRaw);
        setAssessmentData(parsed);
      } catch {
        // ignore parse errors
      }
    }
    const savedTier = localStorage.getItem(STORAGE_KEYS.selectedTier);
    if (savedTier) setSelectedTier(savedTier);

    if (checkout === 'success' && sid) {
      // We trust webhook to gate access; here we just move to results and let
      // PaymentVerificationWrapper call your verify endpoint with session_id.
      setSessionId(sid);
      if (tierParam) setSelectedTier(tierParam);

      setCurrentPhase('results');

      // Clean URL so you don't keep success params on refresh
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  const renderCurrentPhase = () => {
    switch (currentPhase) {
      case 'welcome':
        return (
          <WelcomeScreen
            onStartFocusFlicker={() => {
              setCurrentTask('focusFlicker');
              handlePhaseTransition('consent');
            }}
          />
        );
      case 'consent':
        return <ConsentScreen onNext={() => handlePhaseTransition('instructions')} />;
      case 'instructions':
        return <FocusFlickerInstructions onNext={() => handlePhaseTransition('demo')} />;
      case 'demo':
        return <FocusFlickerDemo onNext={() => handlePhaseTransition('practice')} />;
      case 'practice':
        return <FocusFlickerPractice onNext={() => handlePhaseTransition('focusflicker')} />;
      case 'focusflicker':
        return <FocusFlickerTask onComplete={handleAssessmentComplete} />;
      case 'post-assessment':
        return <PostAssessment onNext={() => handlePhaseTransition('pricing')} />;
      case 'pricing':
        return <PricingTiers onTierSelect={handleTierSelection} />;
      case 'results':
        return (
          <PaymentVerificationWrapper
            data={assessmentData}
            tier={selectedTier}
            sessionId={sessionId}
          />
        );
      default:
        return (
          <WelcomeScreen
            onStartFocusFlicker={() => {
              setCurrentTask('focusFlicker');
              handlePhaseTransition('consent');
            }}
          />
        );
    }
  };

  return <div className="min-h-screen bg-gray-50">{renderCurrentPhase()}</div>;
};

export default Index;
