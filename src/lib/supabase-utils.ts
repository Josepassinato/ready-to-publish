import { supabase } from "@/integrations/supabase/client";
import type { GovernanceResult } from "./governance-engine";

export async function saveDecision(result: GovernanceResult, userId: string) {
  const { data, error } = await supabase.from("decisions").insert({
    user_id: userId,
    pipeline_id: result.pipelineId,
    description: (result as any)._description || "Decisão",
    decision_type: result.decisionType.id,
    impact: (result as any)._impact || "medium",
    reversibility: (result as any)._reversibility || "moderate",
    urgency: (result as any)._urgency || "moderate",
    resources_required: (result as any)._resourcesRequired || "moderate",
    verdict: result.verdict,
    overall_score: result.overallScore,
    blocked: result.blocked,
    state_id: result.state.id,
    state_severity: result.state.severity,
    human_score: result.layers.human.score,
    business_score: result.layers.business.score,
    financial_score: result.layers.financial.score,
    relational_score: result.layers.relational.score,
    domain_financial: result.domainScores.financial,
    domain_emotional: result.domainScores.emotional,
    domain_decisional: result.domainScores.decisional,
    domain_operational: result.domainScores.operational,
    domain_relational: result.domainScores.relational,
    domain_energetic: result.domainScores.energetic,
    full_result: result as any,
  }).select().single();

  if (error) throw error;

  // Save readiness plan if exists
  if (result.readinessPlan && data) {
    const plan = result.readinessPlan;
    await supabase.from("readiness_plans").insert({
      decision_id: data.id,
      user_id: userId,
      structural_reason: plan.structuralReason,
      primary_bottleneck: plan.primaryBottleneck as any,
      secondary_bottleneck: plan.secondaryBottleneck as any,
      actions: plan.actions as any,
      reevaluation_triggers: plan.reevaluationTriggers as any,
      timeline: plan.timeline,
      actions_total: plan.actions.length,
    });
  }

  return data;
}

export async function saveStateClassification(
  userId: string,
  assessment: { energy: number; clarity: number; stress: number; confidence: number; load: number },
  overallScore: number,
  stateId: string,
  stateLabel: string,
  stateSeverity: number,
  classificationConfidence: number
) {
  const { error } = await supabase.from("state_classifications").insert({
    user_id: userId,
    energy: assessment.energy,
    clarity: assessment.clarity,
    stress: assessment.stress,
    confidence: assessment.confidence,
    load: assessment.load,
    overall_score: overallScore,
    state_id: stateId,
    state_label: stateLabel,
    state_severity: stateSeverity,
    classification_confidence: classificationConfidence,
  });
  if (error) throw error;
}
