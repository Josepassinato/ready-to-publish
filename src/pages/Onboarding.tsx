import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Shield, ArrowRight, ArrowLeft, User, Briefcase, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OnboardingData {
  // Profile
  name: string;
  company: string;
  role: string;
  sector: string;
  yearsActive: string;
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
  { icon: Briefcase, title: "Seu Negócio", subtitle: "Contexto da sua operação" },
  { icon: Heart, title: "Seu Estado Atual", subtitle: "Como você está agora" },
];

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
    teamSize: "",
    revenueRange: "",
    activeFronts: "",
    energy: 50,
    clarity: 50,
    stress: 50,
    confidence: 50,
    load: 50,
  });

  const update = (field: keyof OnboardingData, value: string | number) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const saveOnboarding = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update profile
      await supabase
        .from("profiles")
        .update({
          name: data.name || null,
          company: data.company || null,
          role: data.role || null,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      // Save memory entries
      const memories = [
        { category: "profile", key: "name", value: data.name },
        { category: "profile", key: "company", value: data.company },
        { category: "profile", key: "role", value: data.role },
        { category: "profile", key: "sector", value: data.sector },
        { category: "profile", key: "years_active", value: data.yearsActive },
        { category: "business", key: "team_size", value: data.teamSize },
        { category: "business", key: "revenue_range", value: data.revenueRange },
        { category: "business", key: "active_fronts", value: data.activeFronts },
        { category: "emotional", key: "initial_energy", value: String(data.energy) },
        { category: "emotional", key: "initial_clarity", value: String(data.clarity) },
        { category: "emotional", key: "initial_stress", value: String(data.stress) },
        { category: "emotional", key: "initial_confidence", value: String(data.confidence) },
        { category: "emotional", key: "initial_load", value: String(data.load) },
      ].filter((m) => m.value);

      if (memories.length > 0) {
        await supabase.from("user_memory").insert(
          memories.map((m) => ({
            user_id: user.id,
            category: m.category,
            key: m.key,
            value: m.value,
            source: "onboarding",
          }))
        );
      }

      navigate("/chat");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return data.name.trim().length > 0;
    return true;
  };

  const StepIcon = STEPS[step].icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Configurar LifeOS</h1>
          <p className="text-sm text-muted-foreground">
            Estas informações ajudam a IA a te conhecer profundamente
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <StepIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{STEPS[step].title}</h2>
            <p className="text-xs text-muted-foreground">{STEPS[step].subtitle}</p>
          </div>
        </div>

        {/* Step Content */}
        <div className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={data.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input
                  value={data.company}
                  onChange={(e) => update("company", e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-2">
                <Label>Papel/Cargo</Label>
                <Input
                  value={data.role}
                  onChange={(e) => update("role", e.target.value)}
                  placeholder="Ex: CEO, Fundador, Diretor"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Input
                    value={data.sector}
                    onChange={(e) => update("sector", e.target.value)}
                    placeholder="Ex: Tech, Saúde"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Anos de atuação</Label>
                  <Input
                    value={data.yearsActive}
                    onChange={(e) => update("yearsActive", e.target.value)}
                    placeholder="Ex: 5"
                    type="number"
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Tamanho do time</Label>
                <Input
                  value={data.teamSize}
                  onChange={(e) => update("teamSize", e.target.value)}
                  placeholder="Ex: 15 pessoas"
                />
              </div>
              <div className="space-y-2">
                <Label>Faixa de receita mensal</Label>
                <Input
                  value={data.revenueRange}
                  onChange={(e) => update("revenueRange", e.target.value)}
                  placeholder="Ex: R$ 50k-100k"
                />
              </div>
              <div className="space-y-2">
                <Label>Frentes ativas</Label>
                <Input
                  value={data.activeFronts}
                  onChange={(e) => update("activeFronts", e.target.value)}
                  placeholder="Ex: 3 projetos principais"
                />
              </div>
            </>
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
                    onValueChange={([v]) => update(item.key, v)}
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

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
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

        {/* Skip */}
        <button
          onClick={() => {
            if (user) {
              supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id).then(() => navigate("/chat"));
            }
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
