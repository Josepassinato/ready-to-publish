import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Shield, ArrowRight, ArrowLeft, User, Briefcase, Heart, PlusCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Venture {
  name: string;
  sector: string;
  role: string;
  teamSize: string;
  revenueRange: string;
  focus: string;
}

interface OnboardingData {
  // Profile
  name: string;
  company: string;
  role: string;
  sector: string;
  yearsActive: string;
  hasMultipleBusinesses: boolean;
  // Business
  teamSize: string;
  revenueRange: string;
  activeFronts: string;
  // State
  energy: number;
  clarity: number;
  stress: number;
  confidence: number;
  load: number;
}

const STEPS = [
  { icon: User, title: "Sobre Você", subtitle: "Quem é você e o que faz" },
  { icon: Briefcase, title: "Sua Operação", subtitle: "Contexto da sua atuação" },
  { icon: Heart, title: "Seu Estado Atual", subtitle: "Como você está agora" },
];

const newVenture = (): Venture => ({
  name: "",
  sector: "",
  role: "",
  teamSize: "",
  revenueRange: "",
  focus: "",
});

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    company: "",
    role: "",
    sector: "",
    yearsActive: "",
    hasMultipleBusinesses: false,
    teamSize: "",
    revenueRange: "",
    activeFronts: "",
    energy: 50,
    clarity: 50,
    stress: 50,
    confidence: 50,
    load: 50,
  });
  const [ventures, setVentures] = useState<Venture[]>([newVenture()]);

  useEffect(() => {
    if (!user) return;
    setData((prev) => ({
      ...prev,
      name: prev.name || user.name || "",
      company: prev.company || user.company || "",
      role: prev.role || user.role || "",
      sector: prev.sector || user.sector || "",
    }));
  }, [user]);

  const createTraceId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const update = (field: keyof OnboardingData, value: string | number | boolean) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const updateVenture = (index: number, field: keyof Venture, value: string) =>
    setVentures((prev) => prev.map((venture, i) => (i === index ? { ...venture, [field]: value } : venture)));

  const addVenture = () => setVentures((prev) => [...prev, newVenture()]);

  const removeVenture = (index: number) =>
    setVentures((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const normalizeVentures = () =>
    ventures
      .map((venture) => ({
        name: venture.name.trim(),
        sector: venture.sector.trim(),
        role: venture.role.trim(),
        teamSize: venture.teamSize.trim(),
        revenueRange: venture.revenueRange.trim(),
        focus: venture.focus.trim(),
      }))
      .filter((venture) => venture.name || venture.sector || venture.role || venture.teamSize || venture.revenueRange || venture.focus);

  const saveOnboarding = async () => {
    if (!user) {
      toast({ title: "Sessão inválida", description: "Faça login novamente.", variant: "destructive" });
      return;
    }

    const traceId = createTraceId("onboarding");
    setSaving(true);
    console.info(`[ONBOARDING][${traceId}] save:start`, {
      step,
      hasMultipleBusinesses: data.hasMultipleBusinesses,
      venturesCount: ventures.length,
    });

    try {
      const normalizedVentures = normalizeVentures();
      const profileCompany = data.hasMultipleBusinesses
        ? (normalizedVentures.length > 0 ? `Portfólio com ${normalizedVentures.length} negócios` : "Portfólio multi-negócios")
        : (data.company || null);
      const profileSector = data.hasMultipleBusinesses ? "Multissetorial" : (data.sector || null);

      const profileResult = await supabase
        .from("profiles")
        .update({
          name: data.name || null,
          company: profileCompany,
          role: data.role || null,
          sector: profileSector,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (profileResult.error) {
        throw new Error(profileResult.error.message || "Falha ao salvar perfil.");
      }

      console.info(`[ONBOARDING][${traceId}] save:profile-ok`);

      const memories = [
        { category: "profile", key: "name", value: data.name },
        { category: "profile", key: "company", value: data.company },
        { category: "profile", key: "role", value: data.role },
        { category: "profile", key: "sector", value: data.sector },
        { category: "profile", key: "years_active", value: data.yearsActive },
        { category: "business", key: "team_size", value: data.teamSize },
        { category: "business", key: "revenue_range", value: data.revenueRange },
        { category: "business", key: "active_fronts", value: data.activeFronts },
        { category: "portfolio", key: "multi_business_mode", value: String(data.hasMultipleBusinesses) },
        { category: "portfolio", key: "portfolio_count", value: String(normalizedVentures.length) },
        { category: "emotional", key: "initial_energy", value: String(data.energy) },
        { category: "emotional", key: "initial_clarity", value: String(data.clarity) },
        { category: "emotional", key: "initial_stress", value: String(data.stress) },
        { category: "emotional", key: "initial_confidence", value: String(data.confidence) },
        { category: "emotional", key: "initial_load", value: String(data.load) },
      ];

      normalizedVentures.forEach((venture, index) => {
        memories.push({
          category: "portfolio",
          key: `venture_${index + 1}`,
          value: JSON.stringify(venture),
        });
      });

      const filteredMemories = memories.filter((memory) => memory.value);
      if (filteredMemories.length > 0) {
        const memoryResult = await supabase.from("user_memory").insert(
          filteredMemories.map((memory) => ({
            user_id: user.id,
            category: memory.category,
            key: memory.key,
            value: memory.value,
            source: "onboarding",
          }))
        );

        if (memoryResult.error) {
          console.warn(`[ONBOARDING][${traceId}] save:memory-error`, memoryResult.error.message);
          toast({
            title: "Dados parciais",
            description: "Perfil salvo, mas parte da memória não foi gravada agora.",
            variant: "destructive",
          });
        }

        const partialErrors = Array.isArray(memoryResult.data)
          ? memoryResult.data.filter((item) => item && typeof item === "object" && "error" in item)
          : [];
        if (partialErrors.length > 0) {
          console.warn(`[ONBOARDING][${traceId}] save:memory-partial-errors`, { partialErrors });
        }
      }

      console.info(`[ONBOARDING][${traceId}] save:done -> /chat`);
      navigate("/chat");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ONBOARDING][${traceId}] save:failed`, { message });
      toast({ title: "Erro no onboarding", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return data.name.trim().length > 0;
    if (step === 1 && data.hasMultipleBusinesses) {
      const normalized = normalizeVentures();
      return normalized.some((venture) => venture.name && venture.sector);
    }
    return true;
  };

  const StepIcon = STEPS[step].icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Configurar LifeOS</h1>
          <p className="text-sm text-muted-foreground">
            Estas informações ajudam a IA a te conhecer com precisão
          </p>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                index <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <StepIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{STEPS[step].title}</h2>
            <p className="text-xs text-muted-foreground">{STEPS[step].subtitle}</p>
          </div>
        </div>

        <div className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={data.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Empresa principal (opcional)</Label>
                <Input
                  value={data.company}
                  onChange={(event) => update("company", event.target.value)}
                  placeholder="Nome da empresa principal"
                />
              </div>
              <div className="space-y-2">
                <Label>Papel/Cargo</Label>
                <Input
                  value={data.role}
                  onChange={(event) => update("role", event.target.value)}
                  placeholder="Ex: CEO, Fundador, Diretor"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Setor principal</Label>
                  <Input
                    value={data.sector}
                    onChange={(event) => update("sector", event.target.value)}
                    placeholder="Ex: Tech, Saúde"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Anos de atuação</Label>
                  <Input
                    value={data.yearsActive}
                    onChange={(event) => update("yearsActive", event.target.value)}
                    placeholder="Ex: 5"
                    type="number"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={data.hasMultipleBusinesses}
                  onChange={(event) => update("hasMultipleBusinesses", event.target.checked)}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Tenho múltiplas áreas/empresas/empreendimentos</p>
                  <p className="text-xs text-muted-foreground">
                    Ative para cadastrar portfólio multi-negócios na próxima etapa.
                  </p>
                </div>
              </label>
            </>
          )}

          {step === 1 && !data.hasMultipleBusinesses && (
            <>
              <div className="space-y-2">
                <Label>Tamanho do time</Label>
                <Input
                  value={data.teamSize}
                  onChange={(event) => update("teamSize", event.target.value)}
                  placeholder="Ex: 15 pessoas"
                />
              </div>
              <div className="space-y-2">
                <Label>Faixa de receita mensal</Label>
                <Input
                  value={data.revenueRange}
                  onChange={(event) => update("revenueRange", event.target.value)}
                  placeholder="Ex: R$ 50k-100k"
                />
              </div>
              <div className="space-y-2">
                <Label>Frentes ativas</Label>
                <Input
                  value={data.activeFronts}
                  onChange={(event) => update("activeFronts", event.target.value)}
                  placeholder="Ex: 3 projetos principais"
                />
              </div>
            </>
          )}

          {step === 1 && data.hasMultipleBusinesses && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Portfólio de negócios</p>
                <p className="text-xs text-muted-foreground">
                  Preencha pelo menos nome e setor em um item para avançar.
                </p>
              </div>

              {ventures.map((venture, index) => (
                <div key={index} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Negócio {index + 1}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVenture(index)}
                      disabled={ventures.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nome do negócio</Label>
                      <Input
                        value={venture.name}
                        onChange={(event) => updateVenture(index, "name", event.target.value)}
                        placeholder="Ex: Escola Vibe Code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Setor/Ramo</Label>
                      <Input
                        value={venture.sector}
                        onChange={(event) => updateVenture(index, "sector", event.target.value)}
                        placeholder="Ex: Educação, E-commerce, Serviços"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Papel no negócio</Label>
                      <Input
                        value={venture.role}
                        onChange={(event) => updateVenture(index, "role", event.target.value)}
                        placeholder="Ex: Sócio, Diretor, Operação"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tamanho do time</Label>
                      <Input
                        value={venture.teamSize}
                        onChange={(event) => updateVenture(index, "teamSize", event.target.value)}
                        placeholder="Ex: 12 pessoas"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Faixa de receita</Label>
                      <Input
                        value={venture.revenueRange}
                        onChange={(event) => updateVenture(index, "revenueRange", event.target.value)}
                        placeholder="Ex: R$ 80k/mês"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Foco atual</Label>
                      <Input
                        value={venture.focus}
                        onChange={(event) => updateVenture(index, "focus", event.target.value)}
                        placeholder="Ex: Escalar vendas e reduzir churn"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addVenture} className="w-full border-dashed">
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar outro negócio
              </Button>
            </div>
          )}

          {step === 2 && (
            <>
              {[
                { key: "energy" as const, label: "Energia", low: "Esgotado", high: "Cheio de energia" },
                { key: "clarity" as const, label: "Clareza Mental", low: "Confuso", high: "Muito claro" },
                { key: "stress" as const, label: "Estresse", low: "Tranquilo", high: "Muito estressado" },
                { key: "confidence" as const, label: "Confiança", low: "Inseguro", high: "Muito confiante" },
                { key: "load" as const, label: "Carga Decisória", low: "Leve", high: "Sobrecarregado" },
              ].map((item) => (
                <div key={item.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{item.label}</Label>
                    <span className="text-sm font-mono text-primary">{data[item.key]}</span>
                  </div>
                  <Slider
                    value={[data[item.key]]}
                    onValueChange={([value]) => update(item.key, value)}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.low}</span>
                    <span>{item.high}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setStep((prevStep) => prevStep - 1)}
            disabled={step === 0}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => {
                const nextTraceId = createTraceId("onboarding-next");
                const allowed = canAdvance();
                console.info(`[ONBOARDING][${nextTraceId}] step:next`, { currentStep: step, allowed });
                if (allowed) setStep((prevStep) => prevStep + 1);
              }}
              disabled={!canAdvance()}
            >
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={saveOnboarding} disabled={saving}>
              {saving ? "Salvando..." : "Começar"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <button
          onClick={async () => {
            if (!user) return;
            const traceId = createTraceId("onboarding-skip");
            console.info(`[ONBOARDING][${traceId}] skip:start`);
            const result = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
            if (result.error) {
              console.error(`[ONBOARDING][${traceId}] skip:failed`, { message: result.error.message });
              toast({
                title: "Erro ao pular onboarding",
                description: result.error.message,
                variant: "destructive",
              });
              return;
            }
            console.info(`[ONBOARDING][${traceId}] skip:done -> /chat`);
            navigate("/chat");
          }}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular por agora →
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
