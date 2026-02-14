import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const Plans = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("readiness_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPlans(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Planos de Prontidão</h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum plano de prontidão ativo.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => {
            const progress = p.actions_total > 0 ? (p.actions_completed / p.actions_total) * 100 : 0;
            const bottleneck = p.primary_bottleneck as any;
            return (
              <Card key={p.id} className="border-border bg-card">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-foreground">{p.structural_reason}</p>
                    <Badge variant="outline" className="shrink-0">{p.status}</Badge>
                  </div>

                  {bottleneck && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Gargalo:</span>
                      <Badge variant="outline" className="border-warning text-warning text-xs">
                        {bottleneck.label} ({bottleneck.score}%)
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="h-1.5 flex-1" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.actions_completed}/{p.actions_total}
                    </span>
                  </div>

                  {p.timeline && (
                    <p className="text-xs text-muted-foreground">Timeline: {p.timeline}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Plans;
