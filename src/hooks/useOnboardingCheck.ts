import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useOnboardingCheck() {
  const { user, loading: authLoading } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(authLoading);
      return;
    }

    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[ONBOARDING_CHECK] query_failed", { message: error.message, userId: user.id });
          // Fallback seguro: se não conseguimos ler, exige onboarding
          setNeedsOnboarding(true);
          setLoading(false);
          return;
        }
        setNeedsOnboarding(!data?.onboarding_completed);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { needsOnboarding, loading };
}
