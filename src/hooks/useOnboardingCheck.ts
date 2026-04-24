import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";
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

    apiGet<{ onboarding_completed?: boolean }>("/api/profile")
      .then((data) => {
        setNeedsOnboarding(!data?.onboarding_completed);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("[ONBOARDING_CHECK] query_failed", { message: String(err), userId: user.id });
        setNeedsOnboarding(true);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { needsOnboarding, loading };
}
