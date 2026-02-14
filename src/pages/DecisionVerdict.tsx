import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { GovernanceResult } from "@/lib/governance-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ShieldAlert, PlusCircle, Clock, AlertTriangle } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const DecisionVerdict = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [decision, setDecision] = useState<any>(null);
  const [result, setResult] = useState<GovernanceResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("decisions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDecision(data);
          setResult(data.full_result as any);
        }
        setLoading(false);
      });
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!decision || !result) {
    return <div className="py-20 text-center text-muted-foreground">Decisão não encontrada.</div>;
  }

  const isSim = result.verdict === "SIM";

  // Radar data
  const radarData = result.domainDetails.map((d) => ({
    domain: d.label,
    score: d.score,
    required: result.decisionType.minRequired,
  }));

  // Scenario chart data
  const scenarioChartData = result.scenarios[0]?.cashProjection.map((_, i) => {
    const point: any = { month: `M${i}` };
    result.scenarios.forEach((s) => {
      point[s.name] = s.cashProjection[i]?.cash || 0;
    });
    return point;
  }) || [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Verdict header */}
      <Card className={`border-2 ${isSim ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
        <CardContent className="flex items-center gap-4 py-6">
          {isSim ? (
            <CheckCircle className="h-12 w-12 text-success shrink-0" />
          ) : (
            <ShieldAlert className="h-12 w-12 text-destructive shrink-0" />
          )}
          <div>
            <h1 className={`text-3xl font-bold ${isSim ? "text-success" : "text-destructive"}`}>
              {result.verdict}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSim
                ? "Decisão compatível com sua capacidade atual"
                : "Capacidade insuficiente para esta decisão"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <span className="font-mono text-4xl font-bold text-foreground">{result.overallScore}</span>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
        </CardContent>
      </Card>

      {/* 4 layers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Humana", score: result.layers.human.score, detail: `Pressão: ${result.layers.human.pressureCapacity}%` },
          { label: "Negócio", score: result.layers.business.score, detail: `Margem: ${result.layers.business.margin}%` },
          { label: "Financeira", score: result.layers.financial.score, detail: `Runway: ${result.layers.financial.runway}m` },
          { label: "Relacional", score: result.layers.relational.score, detail: `Risco: ${result.layers.relational.conflictRisk}%` },
        ].map((layer) => (
          <Card key={layer.label} className="border-border bg-card">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{layer.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-foreground">{layer.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{layer.detail}</p>
              <Progress value={layer.score} className="mt-2 h-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Radar */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">6 Domínios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(222 20% 16%)" />
                <PolarAngleAxis dataKey="domain" tick={{ fill: "hsl(215 16% 52%)", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Atual" dataKey="score" stroke="hsl(213 58% 45%)" fill="hsl(213 58% 45%)" fillOpacity={0.3} />
                <Radar name="Requerido" dataKey="required" stroke="hsl(0 72% 51%)" fill="none" strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 11, color: "hsl(215 16% 52%)" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">4 Cenários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {result.scenarios.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Carga líder</span><span className="font-mono text-foreground">{s.leaderLoad}%</span>
                  <span>Risco</span><span className="font-mono text-foreground">{s.systemicRisk}%</span>
                  <span>P(falha)</span><span className="font-mono text-foreground">{s.failureProbability}%</span>
                  <span>Tensão em</span><span className="font-mono text-foreground">{s.monthsToTension}m</span>
                </div>
              </div>
            ))}
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scenarioChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="month" tick={{ fill: "hsl(215 16% 52%)", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(215 16% 52%)", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 7%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, color: "hsl(210 40% 92%)", fontSize: 12 }} />
                {result.scenarios.map((s) => (
                  <Area key={s.id} type="monotone" dataKey={s.name} stroke={s.color} fill={s.color} fillOpacity={0.1} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Violations */}
      {result.violations.length > 0 && (
        <Card className="border-destructive/30 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Violações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.violations.map((v, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-foreground">{v.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-destructive">{v.score}%</span>
                  <span className="text-xs text-muted-foreground">/ {v.required}%</span>
                  <Badge variant="destructive" className="text-xs">{v.level}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Readiness Plan */}
      {result.readinessPlan && (
        <Card className="border-warning/30 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-warning">Plano de Prontidão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Motivo Estrutural</p>
              <p className="text-sm text-foreground">{result.readinessPlan.structuralReason}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Gargalo Principal</p>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-warning text-warning">
                  {result.readinessPlan.primaryBottleneck.label}
                </Badge>
                <span className="font-mono text-sm text-foreground">{result.readinessPlan.primaryBottleneck.score}%</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Ações Prioritárias</p>
              <div className="space-y-2">
                {result.readinessPlan.actions.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <p className="text-sm text-foreground">{a.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Horizonte: {a.horizon} · Indicador: {a.indicator}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Condição de Reavaliação</p>
              <ul className="space-y-1">
                {result.readinessPlan.reevaluationTriggers.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">Timeline estimada: {result.readinessPlan.timeline}</p>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center px-4">
        Orientação estrutural baseada nos Artigos I–VII da Constituição LifeOS.
        A decisão final e sua execução são responsabilidade exclusiva do líder.
        O LifeOS não substitui consultoria médica, jurídica ou financeira específica.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-3 pb-20 md:pb-0">
        <Link to="/decision/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Decisão
          </Button>
        </Link>
        <Link to="/history">
          <Button variant="outline">
            <Clock className="mr-2 h-4 w-4" />
            Ver Histórico
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default DecisionVerdict;
