import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { GovernanceResult } from "@/lib/governance-engine";
import { useVerdictTTS } from "@/hooks/useVerdictTTS";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ShieldAlert, PlusCircle, Clock, AlertTriangle, Volume2, Pause, Play, Download, Loader2, Brain, FileText } from "lucide-react";
import MindMapModal from "@/components/MindMapModal";
import ParecerConstitucional from "@/components/ParecerConstitucional";
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
  const tts = useVerdictTTS();
  const [mindMapOpen, setMindMapOpen] = useState(false);
  const [parecerOpen, setParecerOpen] = useState(false);

  const isSim = result?.verdict === "SIM" || false;

  const verdictText = useMemo(() => {
    if (!result) return "";
    const parts: string[] = [];

    parts.push(`Veredito: ${result.verdict}.`);
    parts.push(`Score geral: ${result.overallScore} de 100.`);
    parts.push(`Estado de capacidade: ${result.state.label}.`);

    if (isSim) {
      parts.push("Decisao compativel com sua capacidade atual.");
    } else {
      parts.push("Capacidade insuficiente para esta decisao no momento.");
    }

    parts.push(
      `Camada Humana: ${result.layers.human.score} pontos, pressao ${result.layers.human.pressureCapacity} por cento.`
    );
    parts.push(
      `Camada Negocio: ${result.layers.business.score} pontos, margem ${result.layers.business.margin} por cento.`
    );
    parts.push(
      `Camada Financeira: ${result.layers.financial.score} pontos, runway de ${result.layers.financial.runway} meses.`
    );
    parts.push(
      `Camada Relacional: ${result.layers.relational.score} pontos, risco de conflito ${result.layers.relational.conflictRisk} por cento.`
    );

    if (result.violations.length > 0) {
      parts.push(`Existem ${result.violations.length} violacoes:`);
      result.violations.forEach((v) => {
        parts.push(`${v.label}: score ${v.score} por cento, minimo requerido ${v.required} por cento, nivel ${v.level}.`);
      });
    }

    if (result.readinessPlan) {
      const rp = result.readinessPlan;
      parts.push(`Plano de prontidao: ${rp.structuralReason}`);
      parts.push(`Gargalo principal: ${rp.primaryBottleneck.label}, score ${rp.primaryBottleneck.score} por cento.`);
      rp.actions.forEach((a) => {
        parts.push(`Acao: ${a.action}. Horizonte: ${a.horizon}.`);
      });
      parts.push(`Timeline estimada: ${rp.timeline}.`);
    }

    return parts.join(" ");
  }, [result, isSim]);

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



  const handleTTS = () => {
    if (tts.status === "playing" || tts.status === "paused") {
      tts.togglePlayPause();
    } else {
      tts.generate(verdictText);
    }
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

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
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6 px-0">
      {/* Verdict header */}
      <Card className={`border-2 ${isSim ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
        <CardContent className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 py-5 sm:py-6 text-center sm:text-left">
          {isSim ? (
            <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-success shrink-0" />
          ) : (
            <ShieldAlert className="h-10 w-10 sm:h-12 sm:w-12 text-destructive shrink-0" />
          )}
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${isSim ? "text-success" : "text-destructive"}`}>
              {result.verdict}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isSim
                ? "Decisão compatível com sua capacidade atual"
                : "Capacidade insuficiente para esta decisão"}
            </p>
          </div>
          <div className="sm:ml-auto text-center sm:text-right">
            <span className="font-mono text-3xl sm:text-4xl font-bold text-foreground">{result.overallScore}</span>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
        </CardContent>
      </Card>

      {/* TTS - Ouvir Veredito */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          className="w-full h-11 border border-border/50 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all"
          onClick={handleTTS}
          disabled={tts.status === "loading"}
        >
          {tts.status === "loading" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : tts.status === "playing" ? (
            <Pause className="mr-2 h-4 w-4" />
          ) : tts.status === "paused" ? (
            <Play className="mr-2 h-4 w-4" />
          ) : (
            <Volume2 className="mr-2 h-4 w-4" />
          )}
          {tts.status === "loading"
            ? "Gerando audio..."
            : tts.status === "playing"
              ? "Pausar"
              : tts.status === "paused"
                ? "Continuar"
                : "Ouvir Veredito"}
        </Button>

        {(tts.status === "playing" || tts.status === "paused" || (tts.status === "idle" && tts.progress === 100)) && (
          <Card className="border-border bg-card/80">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <button
                onClick={tts.togglePlayPause}
                className="shrink-0 h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                {tts.status === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <div className="flex-1 min-w-0 space-y-1">
                <div
                  className="relative h-1.5 bg-border rounded-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = ((e.clientX - rect.left) / rect.width) * 100;
                    tts.seek(Math.max(0, Math.min(100, pct)));
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100"
                    style={{ width: `${tts.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{formatTime((tts.progress / 100) * tts.duration)}</span>
                  <span>{formatTime(tts.duration)}</span>
                </div>
              </div>

              {tts.blobUrl && (
                <a
                  href={tts.blobUrl}
                  download={`veredito-${id}.mp3`}
                  className="shrink-0 h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  title="Baixar MP3"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {tts.status === "error" && (
          <p className="text-xs text-destructive text-center">{tts.errorMsg}</p>
        )}
      </div>

      {/* Mind Map + Parecer buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="ghost"
          className="flex-1 h-11 min-h-[44px] border border-border/50 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all"
          onClick={() => setMindMapOpen(true)}
        >
          <Brain className="mr-2 h-4 w-4" />
          Mapa Mental
        </Button>
        <Button
          variant="ghost"
          className="flex-1 h-11 min-h-[44px] border border-border/50 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all"
          onClick={() => setParecerOpen(true)}
        >
          <FileText className="mr-2 h-4 w-4" />
          Parecer Constitucional
        </Button>
      </div>

      {/* Modals */}
      <MindMapModal
        open={mindMapOpen}
        onOpenChange={setMindMapOpen}
        result={result}
        decisionDescription={decision?.description}
        userName={user?.user_metadata?.name || user?.user_metadata?.full_name || ""}
      />
      <ParecerConstitucional
        open={parecerOpen}
        onOpenChange={setParecerOpen}
        result={result}
        decisionDescription={decision?.description}
        userName={user?.user_metadata?.name || user?.user_metadata?.full_name || ""}
      />

      {/* 4 layers */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
          <div className="h-56 sm:h-72">
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
          <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6">
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
