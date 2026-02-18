import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { govern } from "@/lib/governance-engine";
import type { Assessment, BusinessInput, FinancialInput, RelationalInput, Decision } from "@/lib/governance-engine";
import { saveDecision, saveStateClassification } from "@/lib/supabase-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, ArrowRight, Zap, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  "Assessment do Líder",
  "Análise do Negócio",
  "Análise Financeira",
  "Análise Relacional",
  "A Decisão",
  "Processamento",
];

const PROCESSING_STEPS = [
  "Validando dados de entrada...",
  "Classificando estado de capacidade...",
  "Analisando 4 camadas...",
  "Resolvendo hierarquia e prioridade...",
  "Checando limites e thresholds...",
  "Simulando 4 cenários...",
  "Gerando plano de prontidão...",
  "Compondo orientação final...",
];

function SliderField({ label, value, onChange, invert }: { label: string; value: number; onChange: (v: number) => void; invert?: boolean }) {
  const displayValue = value;
  const getColor = () => {
    const v = invert ? 100 - value : value;
    if (v < 30) return "text-destructive";
    if (v < 60) return "text-warning";
    return "text-success";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-foreground">{label}</Label>
        <span className={`font-mono text-sm font-bold ${getColor()}`}>{displayValue}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={0} max={100} step={1} />
    </div>
  );
}

function CurrencyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-muted border-border pl-10"
          placeholder="0"
        />
      </div>
    </div>
  );
}

const DecisionNew = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [processingStep, setProcessingStep] = useState(-1);

  // Step 1: Assessment
  const [assessment, setAssessment] = useState<Assessment>({ energy: 50, clarity: 50, stress: 50, confidence: 50, load: 50 });

  // Step 2: Business
  const [business, setBusiness] = useState<BusinessInput>({
    revenue: 0, costs: 0, founderDependence: 50, activeFronts: 3, processMaturity: 50, delegationCapacity: 50,
  });

  // Step 3: Financial
  const [financial, setFinancial] = useState<FinancialInput>({
    revenue: 0, cash: 0, debt: 0, fixedCosts: 0, intendedLeverage: 0,
  });

  // Step 4: Relational
  const [relational, setRelational] = useState<RelationalInput>({
    activeConflicts: 0, criticalDependencies: 0, partnerAlignment: 50, teamStability: 50, ecosystemHealth: 50,
  });

  // Step 5: Decision
  const [decision, setDecision] = useState<Decision>({
    description: "", type: "strategic", impact: "medium", reversibility: "moderate", urgency: "moderate", resourcesRequired: "moderate",
  });

  const syncRevenue = () => {
    if (step === 2 && business.revenue > 0 && financial.revenue === 0) {
      setFinancial((f) => ({ ...f, revenue: business.revenue }));
    }
  };

  const runGovernance = async () => {
    setStep(5);
    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setProcessingStep(i);
      await new Promise((r) => setTimeout(r, 400));
    }

    try {
      const result = govern(assessment, business, financial, relational, decision);

      // Augment result with input metadata for saving
      (result as any)._description = decision.description;
      (result as any)._impact = decision.impact;
      (result as any)._reversibility = decision.reversibility;
      (result as any)._urgency = decision.urgency;
      (result as any)._resourcesRequired = decision.resourcesRequired;

      if (user) {
        await saveStateClassification(
          user.id, assessment, result.overallScore,
          result.state.id, result.state.label, result.state.severity, result.stateConfidence
        );
        const saved = await saveDecision(result, user.id);
        navigate(`/decision/${saved.id}`);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setStep(4);
      setProcessingStep(-1);
    }
  };

  const canProceed = () => {
    if (step === 4) return decision.description.length >= 20;
    return true;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      {/* Stepper — mobile: progress bar, desktop: numbered */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Passo {step + 1} de {STEPS.length}</span>
          <span className="font-medium text-foreground">{STEPS[step]}</span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-muted"
            }`} />
          ))}
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step 1: Assessment */}
          {step === 0 && (
            <>
              <SliderField label="Nível de Energia" value={assessment.energy} onChange={(v) => setAssessment((a) => ({ ...a, energy: v }))} />
              <SliderField label="Clareza Mental" value={assessment.clarity} onChange={(v) => setAssessment((a) => ({ ...a, clarity: v }))} />
              <SliderField label="Quanto estresse você está sentindo?" value={assessment.stress} onChange={(v) => setAssessment((a) => ({ ...a, stress: v }))} invert />
              <SliderField label="Confiança na Própria Avaliação" value={assessment.confidence} onChange={(v) => setAssessment((a) => ({ ...a, confidence: v }))} />
              <SliderField label="Carga Decisória Atual" value={assessment.load} onChange={(v) => setAssessment((a) => ({ ...a, load: v }))} invert />
            </>
          )}

          {/* Step 2: Business */}
          {step === 1 && (
            <>
              <CurrencyInput label="Receita Mensal" value={business.revenue} onChange={(v) => setBusiness((b) => ({ ...b, revenue: v }))} />
              <CurrencyInput label="Custos Operacionais Mensais" value={business.costs} onChange={(v) => setBusiness((b) => ({ ...b, costs: v }))} />
              <SliderField label="Dependência do Fundador" value={business.founderDependence} onChange={(v) => setBusiness((b) => ({ ...b, founderDependence: v }))} invert />
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Número de Frentes Ativas</Label>
                <Select value={String(business.activeFronts)} onValueChange={(v) => setBusiness((b) => ({ ...b, activeFronts: Number(v) }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SliderField label="Maturidade de Processos" value={business.processMaturity} onChange={(v) => setBusiness((b) => ({ ...b, processMaturity: v }))} />
              <SliderField label="Capacidade de Delegação" value={business.delegationCapacity} onChange={(v) => setBusiness((b) => ({ ...b, delegationCapacity: v }))} />
            </>
          )}

          {/* Step 3: Financial */}
          {step === 2 && (
            <>
              <CurrencyInput label="Receita Mensal" value={financial.revenue || business.revenue} onChange={(v) => setFinancial((f) => ({ ...f, revenue: v }))} />
              <CurrencyInput label="Caixa Disponível" value={financial.cash} onChange={(v) => setFinancial((f) => ({ ...f, cash: v }))} />
              <CurrencyInput label="Endividamento Atual" value={financial.debt} onChange={(v) => setFinancial((f) => ({ ...f, debt: v }))} />
              <CurrencyInput label="Compromissos Fixos Mensais" value={financial.fixedCosts} onChange={(v) => setFinancial((f) => ({ ...f, fixedCosts: v }))} />
              <CurrencyInput label="Alavancagem Pretendida" value={financial.intendedLeverage} onChange={(v) => setFinancial((f) => ({ ...f, intendedLeverage: v }))} />
            </>
          )}

          {/* Step 4: Relational */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Conflitos Ativos</Label>
                <Select value={String(relational.activeConflicts)} onValueChange={(v) => setRelational((r) => ({ ...r, activeConflicts: Number(v) }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Dependências Críticas de Pessoas</Label>
                <Select value={String(relational.criticalDependencies)} onValueChange={(v) => setRelational((r) => ({ ...r, criticalDependencies: Number(v) }))}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SliderField label="Alinhamento com Parceiros/Sócios" value={relational.partnerAlignment} onChange={(v) => setRelational((r) => ({ ...r, partnerAlignment: v }))} />
              <SliderField label="Estabilidade do Time" value={relational.teamStability} onChange={(v) => setRelational((r) => ({ ...r, teamStability: v }))} />
              <SliderField label="Saúde do Ecossistema" value={relational.ecosystemHealth} onChange={(v) => setRelational((r) => ({ ...r, ecosystemHealth: v }))} />
            </>
          )}

          {/* Step 5: Decision */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Descreva a decisão que você quer tomar</Label>
                <Textarea
                  value={decision.description}
                  onChange={(e) => setDecision((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Mínimo 20 caracteres..."
                  className="min-h-24 bg-muted border-border"
                />
                <p className="text-xs text-muted-foreground">{decision.description.length}/20 caracteres mínimos</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm text-foreground">
                    Tipo
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-64">
                        <p className="text-xs">Existencial: muda tudo. Estrutural: reorganiza. Estratégica: direciona. Tática: ajusta.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select value={decision.type} onValueChange={(v: any) => setDecision((d) => ({ ...d, type: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existential">Existencial</SelectItem>
                      <SelectItem value="structural">Estrutural</SelectItem>
                      <SelectItem value="strategic">Estratégica</SelectItem>
                      <SelectItem value="tactical">Tática</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-foreground">Impacto Esperado</Label>
                  <Select value={decision.impact} onValueChange={(v: any) => setDecision((d) => ({ ...d, impact: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transformational">Transformacional</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="low">Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-foreground">Reversibilidade</Label>
                  <Select value={decision.reversibility} onValueChange={(v: any) => setDecision((d) => ({ ...d, reversibility: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="irreversible">Irreversível</SelectItem>
                      <SelectItem value="difficult">Difícil</SelectItem>
                      <SelectItem value="moderate">Moderada</SelectItem>
                      <SelectItem value="easy">Fácil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-foreground">Urgência</Label>
                  <Select value={decision.urgency} onValueChange={(v: any) => setDecision((d) => ({ ...d, urgency: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Crítica</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="moderate">Moderada</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm text-foreground">Recursos Envolvidos</Label>
                  <Select value={decision.resourcesRequired} onValueChange={(v: any) => setDecision((d) => ({ ...d, resourcesRequired: v }))}>
                    <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="massive">Massivos</SelectItem>
                      <SelectItem value="significant">Significativos</SelectItem>
                      <SelectItem value="moderate">Moderados</SelectItem>
                      <SelectItem value="minimal">Mínimos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Step 6: Processing */}
          {step === 5 && (
            <div className="space-y-3 py-4">
              {PROCESSING_STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    i <= processingStep ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ animationDelay: `${i * 400}ms` }}
                >
                  <div className={`h-2 w-2 rounded-full ${
                    i < processingStep ? "bg-success" : i === processingStep ? "bg-primary animate-pulse" : "bg-muted"
                  }`} />
                  <span className={`text-sm ${
                    i <= processingStep ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {step < 5 && (
        <div className="flex justify-between gap-3 pb-4">
          <Button
            variant="ghost"
            size="lg"
            className="h-12 px-4"
            onClick={() => { if (step === 2) syncRevenue(); setStep(step - 1); }}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>

          {step < 4 ? (
            <Button size="lg" className="h-12 px-6" onClick={() => { if (step === 1) syncRevenue(); setStep(step + 1); }}>
              Próximo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" className="h-12 px-5" onClick={runGovernance} disabled={!canProceed()}>
              <Zap className="mr-2 h-4 w-4" />
              Executar Governo
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DecisionNew;
