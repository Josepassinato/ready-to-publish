import { useState, useCallback, useMemo } from "react";
import { Shield, CheckCircle2 } from "lucide-react";
import { classifyState } from "@/lib/governance-engine";
import type { Assessment } from "@/lib/governance-engine";

interface CalibrationResult {
  assessment: Assessment;
  stateLabel: string;
  stateColor: string;
  stateSeverity: number;
  overallScore: number;
  confidence: number;
}

interface CalibrationFlowProps {
  onComplete: (result: CalibrationResult) => void;
  userName: string;
}

interface CalibrationStep {
  id: string;
  title: string;
  highlight: string;
  subtitle: string;
  labelLow: string;
  labelHigh: string;
}

function buildSteps(name: string): CalibrationStep[] {
  return [
    {
      id: "energy",
      title: `${name}, como esta sua`,
      highlight: "ENERGIA E CLAREZA MENTAL",
      subtitle: "hoje?",
      labelLow: "Muito baixa",
      labelHigh: "Excelente",
    },
    {
      id: "load",
      title: `${name}, como esta sua`,
      highlight: "CARGA DECISORIA",
      subtitle: "?",
      labelLow: "Muito pesada",
      labelHigh: "Muito leve",
    },
    {
      id: "stress",
      title: `${name}, como esta seu nivel de`,
      highlight: "ESTRESSE",
      subtitle: "?",
      labelLow: "Muito alto",
      labelHigh: "Muito baixo",
    },
    {
      id: "confidence",
      title: `${name}, qual sua`,
      highlight: "CONFIANCA",
      subtitle: "na propria avaliacao?",
      labelLow: "Muito baixa",
      labelHigh: "Muito alta",
    },
    {
      id: "workload",
      title: `${name}, qual sua`,
      highlight: "CARGA DE TRABALHO",
      subtitle: "atual?",
      labelLow: "Muito pesada",
      labelHigh: "Muito leve",
    },
  ];
}

const BUTTON_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: "bg-red-500/20", border: "border-red-500/60", text: "text-red-400" },
  2: { bg: "bg-orange-500/20", border: "border-orange-500/60", text: "text-orange-400" },
  3: { bg: "bg-yellow-500/20", border: "border-yellow-500/60", text: "text-yellow-400" },
  4: { bg: "bg-emerald-500/20", border: "border-emerald-500/60", text: "text-emerald-400" },
  5: { bg: "bg-green-500/20", border: "border-green-500/60", text: "text-green-400" },
};

const BUTTON_COLORS_SELECTED: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: "bg-red-500", border: "border-red-500", text: "text-white" },
  2: { bg: "bg-orange-500", border: "border-orange-500", text: "text-white" },
  3: { bg: "bg-yellow-500", border: "border-yellow-500", text: "text-black" },
  4: { bg: "bg-emerald-500", border: "border-emerald-500", text: "text-white" },
  5: { bg: "bg-green-500", border: "border-green-500", text: "text-white" },
};

const CalibrationFlow = ({ onComplete, userName }: CalibrationFlowProps) => {
  const steps = useMemo(() => buildSteps(userName), [userName]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [transitioning, setTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<CalibrationResult | null>(null);

  const handleSelect = useCallback(
    (value: number) => {
      if (transitioning) return;

      const stepId = steps[currentStep].id;
      const newAnswers = { ...answers, [stepId]: value };
      setAnswers(newAnswers);

      if (currentStep < steps.length - 1) {
        // Advance to next step with transition
        setTransitioning(true);
        setTimeout(() => {
          setCurrentStep((prev) => prev + 1);
          setTransitioning(false);
        }, 300);
      } else {
        // All done - compute result
        setTransitioning(true);
        setTimeout(() => {
          const assessment = buildAssessment(newAnswers);
          const classified = classifyState(assessment);
          const calibrationResult: CalibrationResult = {
            assessment,
            stateLabel: classified.state.label,
            stateColor: classified.state.color,
            stateSeverity: classified.state.severity,
            overallScore: classified.score,
            confidence: classified.confidence,
          };
          setResult(calibrationResult);
          setCompleted(true);
          setTransitioning(false);
        }, 300);
      }
    },
    [currentStep, answers, transitioning, steps]
  );

  const handleContinue = useCallback(() => {
    if (result) {
      onComplete(result);
    }
  }, [result, onComplete]);

  if (completed && result) {
    return (
      <div className="calibration-fade-in flex flex-col items-center justify-center px-4 py-8 space-y-6">
        {/* Result Card */}
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-center">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-full"
              style={{ backgroundColor: `${result.stateColor}20`, border: `2px solid ${result.stateColor}` }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: result.stateColor }} />
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">Seu estado atual</p>
            <h2 className="text-xl font-semibold" style={{ color: result.stateColor }}>
              {result.stateLabel}
            </h2>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{result.overallScore}%</p>
              <p className="text-xs text-muted-foreground">Score Geral</p>
            </div>
            <div
              className="w-px h-10"
              style={{ backgroundColor: "hsl(var(--border))" }}
            />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{Math.round(result.confidence * 100)}%</p>
              <p className="text-xs text-muted-foreground">Confianca</p>
            </div>
            <div
              className="w-px h-10"
              style={{ backgroundColor: "hsl(var(--border))" }}
            />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{result.stateSeverity}</p>
              <p className="text-xs text-muted-foreground">Severidade</p>
            </div>
          </div>

          {/* Score bar */}
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${result.overallScore}%`,
                  backgroundColor: result.stateColor,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Continue prompt */}
        <div className="text-center space-y-4 w-full max-w-sm">
          <p className="text-base text-muted-foreground">
            {userName}, agora descreva sua decisao ou peca orientacao.
          </p>
          <button
            onClick={handleContinue}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors"
          >
            Continuar para o Chat
          </button>
        </div>
      </div>
    );
  }

  const step = steps[currentStep];

  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 space-y-8">
      {/* LifeOS Icon + Greeting */}
      <div className="flex flex-col items-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        {currentStep === 0 && !transitioning && (
          <p className="text-base text-muted-foreground calibration-fade-in">
            Ola, <span className="text-foreground font-medium">{userName}</span>! Vamos calibrar seu estado de capacidade.
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Calibracao {currentStep + 1}/{steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(((currentStep + (answers[step.id] ? 1 : 0)) / steps.length) * 100)}%
          </span>
        </div>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                i < currentStep
                  ? "bg-primary"
                  : i === currentStep
                    ? "bg-primary/60"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div
        className={`text-center space-y-2 transition-all duration-300 ${
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        <h2 className="text-[20px] font-semibold leading-tight text-foreground">
          {step.title}{" "}
          <span className="text-primary">{step.highlight}</span>{" "}
          {step.subtitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          Toque no numero que melhor representa como voce esta agora
        </p>
      </div>

      {/* Scale Buttons */}
      <div
        className={`w-full max-w-sm transition-all duration-300 ${
          transitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        <div className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((value) => {
            const selected = answers[step.id] === value;
            const colors = selected ? BUTTON_COLORS_SELECTED[value] : BUTTON_COLORS[value];

            return (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                className={`
                  flex items-center justify-center
                  w-14 h-14 min-w-[48px] min-h-[48px]
                  rounded-xl border-2
                  text-xl font-bold
                  transition-all duration-200
                  active:scale-95
                  ${colors.bg} ${colors.border} ${colors.text}
                  ${selected ? "ring-2 ring-offset-2 ring-offset-background" : "hover:scale-105"}
                `}
                style={selected ? { ringColor: colors.border } : undefined}
                disabled={transitioning}
              >
                {value}
              </button>
            );
          })}
        </div>

        {/* Labels below buttons */}
        <div className="flex justify-between mt-3 px-1">
          <span className="text-xs text-muted-foreground">{step.labelLow}</span>
          <span className="text-xs text-muted-foreground">{step.labelHigh}</span>
        </div>
      </div>

      {/* Step dots indicator */}
      <div className="flex gap-2 pt-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === currentStep
                ? "bg-primary w-6"
                : i < currentStep
                  ? "bg-primary/50"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// Maps 1-5 answers to Assessment (0-100)
function buildAssessment(answers: Record<string, number>): Assessment {
  // Energy: 1=20 (very low) → 5=100 (excellent)
  const energy = (answers.energy || 3) * 20;

  // Clarity derived from energy (same question covers both)
  const clarity = (answers.energy || 3) * 20;

  // Load: 1=Muito pesada (high load=bad) → 5=Muito leve (low load=good)
  // In Assessment, load high = ruim, so invert: 5→20, 1→100
  const load = (6 - (answers.load || 3)) * 20;

  // Stress: 1=Muito alto (high stress=bad) → 5=Muito baixo (low stress=good)
  // In Assessment, stress high = ruim, so invert: 5→20, 1→100
  const stress = (6 - (answers.stress || 3)) * 20;

  // Confidence: 1=Muito baixa → 5=Muito alta
  const confidence = (answers.confidence || 3) * 20;

  // Workload adjusts clarity: heavy workload reduces clarity
  // workload 1=heavy → clarity penalty, 5=light → clarity boost
  const workloadFactor = (answers.workload || 3) * 20;
  const adjustedClarity = Math.round((clarity + workloadFactor) / 2);

  return {
    energy: Math.min(100, energy),
    clarity: Math.min(100, adjustedClarity),
    stress: Math.min(100, stress),
    confidence: Math.min(100, confidence),
    load: Math.min(100, load),
  };
}

export default CalibrationFlow;
export type { CalibrationResult };
