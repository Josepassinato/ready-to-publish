// ═══════════════════════════════════════════════════════════════
//  LIFEOS — FEATURE FLAGS
//  Kill-switch do LLM e outras flags de controle.
// ═══════════════════════════════════════════════════════════════

import { supabase } from "@/integrations/supabase/client";

export const FLAGS = {
  LLM_ENABLED: "llm_enabled",
} as const;

export type FlagName = (typeof FLAGS)[keyof typeof FLAGS];

/**
 * Check if a feature flag is enabled for the user.
 * Returns true by default if the flag doesn't exist (opt-out model).
 */
export async function isFeatureEnabled(userId: string, flagName: FlagName): Promise<boolean> {
  const { data, error } = await supabase
    .from("feature_flags" as any)
    .select("enabled")
    .eq("user_id", userId)
    .eq("flag_name", flagName)
    .maybeSingle();

  if (error || !data) return true; // Default: enabled
  return (data as any).enabled;
}

/**
 * Set a feature flag for the user (upsert).
 */
export async function setFeatureFlag(userId: string, flagName: FlagName, enabled: boolean): Promise<void> {
  // Try update first
  const { data: existing } = await supabase
    .from("feature_flags" as any)
    .select("id")
    .eq("user_id", userId)
    .eq("flag_name", flagName)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("feature_flags" as any)
      .update({ enabled, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId)
      .eq("flag_name", flagName);
  } else {
    await supabase
      .from("feature_flags" as any)
      .insert({ user_id: userId, flag_name: flagName, enabled } as any);
  }
}

/**
 * Check if LLM is enabled (shorthand).
 */
export async function isLLMEnabled(userId: string): Promise<boolean> {
  return isFeatureEnabled(userId, FLAGS.LLM_ENABLED);
}
