// ═══════════════════════════════════════════════════════════════
//  LIFEOS — AUDIT LOGGER
//  Registro append-only de cada etapa do pipeline de governança.
//  Nenhum log pode ser alterado ou deletado (RLS garante).
// ═══════════════════════════════════════════════════════════════

import { supabase } from "@/integrations/supabase/client";
import type { GovernanceResult, Assessment, BusinessInput, FinancialInput, RelationalInput, Decision } from "./governance-engine";
import { CONSTITUTION_VERSION } from "./governance-engine";

export type AuditEventType =
  | "intake"
  | "state_classification"
  | "layer_analysis"
  | "threshold_check"
  | "scenario_simulation"
  | "verdict"
  | "readiness_plan";

interface AuditEntry {
  pipeline_id: string;
  user_id: string;
  event_type: AuditEventType;
  event_data: Record<string, unknown>;
  constitution_version: string;
}

// Buffer entries during pipeline execution, then flush all at once
let buffer: AuditEntry[] = [];

function push(pipelineId: string, userId: string, eventType: AuditEventType, data: Record<string, unknown>) {
  buffer.push({
    pipeline_id: pipelineId,
    user_id: userId,
    event_type: eventType,
    event_data: data,
    constitution_version: CONSTITUTION_VERSION,
  });
}

/**
 * Record the full pipeline execution as audit events.
 * Called after govern() completes, with the inputs and result.
 */
export function recordPipelineAudit(
  userId: string,
  inputs: {
    assessment: Assessment;
    business: BusinessInput;
    financial: FinancialInput;
    relational: RelationalInput;
    decision: Decision;
  },
  result: GovernanceResult
) {
  const pid = result.pipelineId;
  buffer = [];

  // 1. Intake — raw inputs
  push(pid, userId, "intake", {
    assessment: inputs.assessment,
    business: inputs.business,
    financial: inputs.financial,
    relational: inputs.relational,
    decision: {
      description: inputs.decision.description,
      type: inputs.decision.type,
      impact: inputs.decision.impact,
      reversibility: inputs.decision.reversibility,
      urgency: inputs.decision.urgency,
      resourcesRequired: inputs.decision.resourcesRequired,
    },
  });

  // 2. State Classification
  push(pid, userId, "state_classification", {
    stateId: result.state.id,
    stateLabel: result.state.label,
    severity: result.state.severity,
    score: result.overallScore,
    confidence: result.stateConfidence,
    transitionWarning: result.transitionWarning,
  });

  // 3. Layer Analysis
  push(pid, userId, "layer_analysis", {
    human: result.layers.human,
    business: result.layers.business,
    financial: result.layers.financial,
    relational: result.layers.relational,
  });

  // 4. Threshold Check
  push(pid, userId, "threshold_check", {
    domainScores: result.domainScores,
    violations: result.violations,
    blocked: result.blocked,
    decisionType: result.decisionType,
    gap: result.gap,
  });

  // 5. Scenario Simulation
  push(pid, userId, "scenario_simulation", {
    scenarios: result.scenarios.map(s => ({
      id: s.id,
      name: s.name,
      leaderLoad: s.leaderLoad,
      systemicRisk: s.systemicRisk,
      failureProbability: s.failureProbability,
      monthsToTension: s.monthsToTension,
      breakMonth: s.breakMonth,
    })),
  });

  // 6. Verdict
  push(pid, userId, "verdict", {
    verdict: result.verdict,
    overallScore: result.overallScore,
    blocked: result.blocked,
  });

  // 7. Readiness Plan (if generated)
  if (result.readinessPlan) {
    push(pid, userId, "readiness_plan", {
      structuralReason: result.readinessPlan.structuralReason,
      primaryBottleneck: result.readinessPlan.primaryBottleneck,
      secondaryBottleneck: result.readinessPlan.secondaryBottleneck,
      actionsCount: result.readinessPlan.actions.length,
      timeline: result.readinessPlan.timeline,
    });
  }

  return flushAuditBuffer();
}

async function flushAuditBuffer(): Promise<void> {
  if (buffer.length === 0) return;

  const entries = [...buffer];
  buffer = [];

  const { error } = await supabase
    .from("governance_audit_log" as any)
    .insert(entries as any);

  if (error) {
    console.error("[AuditLogger] Failed to flush audit log:", error);
    // Non-blocking: audit failure should never break the pipeline
  }
}
