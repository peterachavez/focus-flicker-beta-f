// src/pages/Index.tsx
import React from "react";
import WelcomeScreen from "../components/WelcomeScreen";
import ConsentScreen from "../components/ConsentScreen";
import PostAssessment from "../components/PostAssessment";
import PricingTiers from "../components/PricingTiers";
import PaymentVerificationWrapper from "../components/PaymentVerificationWrapper";

// Focus Flicker task components
import FocusFlickerInstructions from "../components/FocusFlickerInstructions";
import FocusFlickerDemo from "../components/FocusFlickerDemo";
import FocusFlickerPractice from "../components/FocusFlickerPractice";
import FocusFlickerTask from "../components/FocusFlickerTask";

export type AppPhase =
  | "welcome"
  | "consent"
  | "instructions"
  | "demo"
  | "practice"
  | "focusflicker" // assessment phase
  | "post-assessment"
  | "pricing"
  | "results";

// Only Focus Flicker is available as a task
export type TaskType = "focusFlicker";

export interface TrialData {
  trial_number: number;
  user_choice: string;
  correct: boolean;
  /**
   * For Focus Flicker this value is always 'flicker' so downstream
   * components can distinguish paradigms without misinterpreting data.
   */
  rule: "color" | "shape" | "number" | "flicker";
  response_time: number;
  perseverative: boolean;
  adaptation_latency: number | null;
  trial_type: "core" | "buffer" | "guided" | "extended" | "demo" | "practice";
  timestamp: number;
  initial_rule_discovery_latency: number | null;
  rule_switch: boolean;
  consecutive_errors: number;
  trial_in_block: number;
  rule_block_number: number;

  // Focus Flicker-specific
  change_occurred?: boolean;
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

  // Focus Flicker-specific
  attention_score?: number;
}

const STORAGE_KEYS = {
  assessmentData: "assessment_data",
  assessmentId: "current_assessment_id",
  selectedTier: "selected_tier",
};

// small, dependency-free id (fallback when crypto.randomUUID is unavailable)
const genId = () =>
  `fs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const Index = () => {
  const [currentPhase, setCurrentPhase] = React.useState<AppPhase>("welcome");
  const [currentTask, setCurrentTask] = React.useState<TaskType>("focusFlicker");
  const [assessmentData, setAssessmentData] = React.useState<AssessmentData>({
    trials: [],
    cognitive_flexibility_score: 0,
    shifts_achieved: 0,
    perseverative_errors: 0,
    adaptation_latency: 0,
    avg_response_time: 0,
    guided_mode_triggered: false,
    rule_training_triggered: false,
    completed_at: "",
  });
  const [selectedTier, setSelectedTier] = React.useState<string>("free");
  const [sessionId, setSessionId] = React.useState<string>("");

  function handlePhaseTransition(nextPhase: AppPhase) {
    setCurrentPhase(nextPhase);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ✅ NEW: Whenever we ENTER the assessment phase ('focusflicker'),
  // generate a fresh assessment_id and clear stale plan hints.
  // This ensures a truly Free run stays free unless a *new* purchase is made.
  // ────────────────────────────────────────────────────────────────────────────
  const prevPhaseRef = React.useRef<AppPhase>("welcome");
  React.useEffect(() => {
    if (prevPhaseRef.current !== "focusflicker" && currentPhase === "focusflicker") {
      try {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : genId();

        localStorage.setItem(STORAGE_KEYS.assessmentId, id);

        // Clear any stale plan hints so this run starts as truly "free"
        localStorage.removeItem("access_plan");
        localStorage.removeItem(STORAGE_KEYS.selectedTier);
        setSelectedTier("free");
      } catch {
        // best-effort; ignore
      }
    }
    prevPhaseRef.current = currentPhase;
  }, [currentPhase]);
  // ────────────────────────────────────────────────────────────────────────────

  // When assessment completes, persist results (ID is already set when we entered 'focusflicker')
  const handleAssessmentComplete = (
    data: AssessmentData | (AssessmentData & { task?: string })
  ) => {
    const existingId = localStorage.getItem(STORAGE_KEYS.assessmentId);
    const assessmentId =
      existingId ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : genId());

    const tagged = { ...data, task: (data as any).task || currentTask } as any;

    localStorage.setItem(STORAGE_KEYS.assessmentId, assessmentId);
    localStorage.setItem(STORAGE_KEYS.assessmentData, JSON.stringify(tagged));

    setAssessmentData(tagged);
    setCurrentPhase("post-assessment");
  };

  // Pricing tier selection
  const handleTierSelection = (tier: string) => {
    setSelectedTier(tier);
    localStorage.setItem(STORAGE_KEYS.selectedTier, tier);

    if (tier === "free") {
      // Free unlocks immediately
      setCurrentPhase("results");
    } else {
      // Paid tiers: remain on pricing; PricingTiers will redirect to Stripe
      setCurrentPhase("pricing");
    }
  };

  // On first mount:
  // 1) If returning from Stripe (?checkout=success), capture params.
  // 2) Otherwise, hydrate local results for refresh resilience.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const tierParam = params.get("tier");
    const sid = params.get("session_id");

    // Hydrate stored results (covers fresh return & plain refresh)
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

    if (checkout === "success" && sid) {
      // Move to results and let PaymentVerificationWrapper verify the session.
      setSessionId(sid);
      if (tierParam) setSelectedTier(tierParam);
      setCurrentPhase("results");

      // Clean URL so refresh doesn't re-trigger parsing
      try {
        const { origin, pathname, hash } = window.location;
        window.history.replaceState({}, document.title, `${origin}${pathname}${hash || ""}`);
      } catch {
        window.history.replaceState({}, document.title, "/");
      }
    }
  }, []);

  const renderCurrentPhase = () => {
    switch (currentPhase) {
      case "welcome":
        return (
          <WelcomeScreen
            onStartFocusFlicker={() => {
              setCurrentTask("focusFlicker");
              handlePhaseTransition("consent");
            }}
          />
        );
      case "consent":
        return <ConsentScreen onNext={() => handlePhaseTransition("instructions")} />;
      case "instructions":
        return <FocusFlickerInstructions onNext={() => handlePhaseTransition("demo")} />;
      case "demo":
        return <FocusFlickerDemo onNext={() => handlePhaseTransition("practice")} />;
      case "practice":
        return <FocusFlickerPractice onNext={() => handlePhaseTransition("focusflicker")} />;
      case "focusflicker":
        return <FocusFlickerTask onComplete={handleAssessmentComplete} />;
      case "post-assessment":
        return <PostAssessment onNext={() => handlePhaseTransition("pricing")} />;
      case "pricing":
        return <PricingTiers onTierSelect={handleTierSelection} />;
      case "results":
        return (
          <PaymentVerificationWrapper
            data={assessmentData}
            tier={selectedTier as "free" | "starter" | "pro"}
            sessionId={sessionId}
          />
        );
      default:
        return (
          <WelcomeScreen
            onStartFocusFlicker={() => {
              setCurrentTask("focusFlicker");
              handlePhaseTransition("consent");
            }}
          />
        );
    }
  };

  return <div className="min-h-screen bg-gray-50">{renderCurrentPhase()}</div>;
};

export default Index;
