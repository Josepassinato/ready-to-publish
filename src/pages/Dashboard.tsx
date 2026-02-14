import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlusCircle, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const STATE_COLORS: Record<string, string> = {
  active_failure: "bg-destructive",
  insufficient: "bg-warning",
  failure_risk: "bg-warning",
  under_tension: "bg-warning",
  recovery: "bg-warning",
  building: "bg-success",
  stable: "bg-success",
  controlled_expansion: "bg-success",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [decisionsRes, plansRes, trendRes] = await Promise.all([
        supabase
          .from("decisions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("readiness_plans")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase.rpc("get_capacity_trend", { p_user_id: user.id, p_limit: 10 }),
      ]);

      setDecisions(decisionsRes.data || []);
      setPlans(plansRes.data || []);
      setTrend(
        (trendRes.data || [])
          .reverse()
          .map((t: any, i: number) => ({
            index: i + 1,
            score: t.overall_score,
          }))
      );
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const lastDecision = decisions[0];
  const lastState = lastDecision?.state_id;
  const lastScore = lastDecision?.overall_score;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da sua capacidade</p>
        </div>
        <Link to="/decision/new">
          <Button className="animate-pulse-glow">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Decisão
          </Button>
        </Link>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Estado Atual</CardTitle>
          </CardHeader>
          <CardContent>
            {lastDecision ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${STATE_COLORS[lastState] || "bg-muted"}`} />
                  <span className="font-mono text-2xl font-bold text-foreground">{lastScore}%</span>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{lastState?.replace(/_/g, " ")}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma avaliação</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Decisões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl font-bold text-foreground">{decisions.length}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle className="h-3 w-3" />
                  {decisions.filter((d) => d.verdict === "SIM").length}
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {decisions.filter((d) => d.verdict === "NÃO AGORA").length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Planos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-bold text-foreground">{plans.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      {trend.length > 1 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Evolução da Capacidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <XAxis dataKey="index" tick={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "hsl(215 16% 52%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(222 47% 7%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, color: "hsl(210 40% 92%)" }}
                  />
                  <Line type="monotone" dataKey="score" stroke="hsl(213 58% 45%)" strokeWidth={2} dot={{ fill: "hsl(213 58% 45%)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent decisions */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Decisões Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma decisão registrada. Comece uma nova avaliação.
            </p>
          ) : (
            <div className="space-y-3">
              {decisions.map((d) => (
                <Link
                  key={d.id}
                  to={`/decision/${d.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{d.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("pt-BR")} · {d.decision_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">{d.overall_score}%</span>
                    <Badge variant={d.verdict === "SIM" ? "default" : "destructive"} className={d.verdict === "SIM" ? "bg-success text-success-foreground" : ""}>
                      {d.verdict}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active plans */}
      {plans.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Planos de Prontidão Ativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans.map((p) => (
              <div key={p.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{p.structural_reason?.slice(0, 80)}...</p>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.actions_completed}/{p.actions_total}
                  </span>
                </div>
                <Progress value={(p.actions_completed / p.actions_total) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
