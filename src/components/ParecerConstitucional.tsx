import { useRef, useCallback } from "react";
import type { GovernanceResult } from "@/lib/governance-engine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface ParecerConstitucionalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: GovernanceResult;
  decisionDescription?: string;
  userName?: string;
}

// ── Section component ─────────────────────────────────────────────

const Section = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
      Passo {step} -- {title}
    </h3>
    <div className="text-xs leading-relaxed text-muted-foreground space-y-1.5">
      {children}
    </div>
  </div>
);

const ArticleRef = ({ text }: { text: string }) => (
  <p className="text-[11px] italic text-primary/70 pl-3 border-l-2 border-primary/30">{text}</p>
);

const DataRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex gap-2">
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-mono text-foreground">{value}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────

const ParecerConstitucional = ({ open, onOpenChange, result, decisionDescription, userName }: ParecerConstitucionalProps) => {
  const parecerRef = useRef<HTMLDivElement>(null);
  const isSim = result.verdict === "SIM";
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const exportPDF = useCallback(async () => {
    if (!parecerRef.current) return;
    const canvas = await html2canvas(parecerRef.current, {
      backgroundColor: "#0A1628",
      scale: 2,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");
    const w = canvas.width;
    const h = canvas.height;
    const pdfW = 210;
    const pdfH = (h * pdfW) / w;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfW, pdfH + 10] });
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`lifeos-parecer-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, []);

  // Helpers
  const stateLabel = result.state.label;
  const stateScore = result.overallScore;
  const dtConfig = result.decisionType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border p-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-base font-semibold text-foreground">Parecer Constitucional</DialogTitle>
        </DialogHeader>

        {/* Export */}
        <div className="flex gap-2 px-5">
          <Button variant="ghost" size="sm" className="h-9 min-h-[44px] border border-border/50 text-xs" onClick={exportPDF}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar PDF
          </Button>
        </div>

        {/* Parecer content */}
        <div ref={parecerRef} className="px-6 pb-6 pt-3 space-y-5 text-foreground" style={{ backgroundColor: "#0A1628" }}>

          {/* Header */}
          <div className="text-center space-y-1 border-b border-border pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Parecer de Governanca -- LifeOS</p>
            <p className="text-[10px] text-muted-foreground">Protocolo Luz & Vaso -- Constituicao Artigos I-VII</p>
            <p className="text-[10px] text-muted-foreground">Data: {dateStr} | Usuario: {userName || "---"}</p>
          </div>

          {/* Decisão avaliada */}
          {decisionDescription && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Decisao Avaliada</p>
              <p className="text-sm text-foreground">{decisionDescription}</p>
            </div>
          )}

          {/* PASSO 1 — Estado de Capacidade */}
          <Section step={1} title="Estado de Capacidade Classificado">
            <DataRow label="Estado identificado" value={stateLabel} />
            <DataRow label="Severidade" value={result.state.severity} />
            <ArticleRef text='Artigo II, &sect;1 -- "Todo individuo opera em estados identificaveis de capacidade e expansao. Esses estados nao sao julgamentos morais, mas condicoes estruturais temporarias."' />
            <ArticleRef text='Artigo II, &sect;4 -- "O LifeOS deve, obrigatoriamente, classificar o estado atual antes de qualquer orientacao."' />
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
              <DataRow label="Energy" value={result.domainScores.energetic} />
              <DataRow label="Clarity" value={result.domainScores.decisional} />
              <DataRow label="Emotional" value={result.domainScores.emotional} />
              <DataRow label="Confidence" value={`${result.stateConfidence * 100}%`} />
            </div>
            <DataRow label="Confidence score" value={`${Math.round(result.stateConfidence * 100)}%`} />
          </Section>

          {/* PASSO 2 — Tipo de Decisão */}
          <Section step={2} title="Tipo de Decisao Classificado">
            <DataRow label="Tipo" value={dtConfig.label} />
            <p className="text-[11px]">Hierarquia aplicada: Existencial &gt; Estrutural &gt; Estrategica &gt; Tatica</p>
            <ArticleRef text='Artigo IV, &sect;1 -- "O LifeOS governa decisoes por hierarquia de consequencia, nao por urgencia percebida."' />
            <ArticleRef text="Artigo IV, &sect;2 -- Definicao das 4 classes de decisao." />
            <DataRow label="Score minimo geral" value={`${dtConfig.minRequired}%`} />
          </Section>

          {/* PASSO 3 — Limites Estruturais */}
          <Section step={3} title="Limites Estruturais Checados">
            <p className="text-[11px]">Dominios avaliados: financeiro, emocional, decisorio, operacional, relacional, energetico</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
              {result.domainDetails.map((d) => (
                <DataRow key={d.id} label={d.label} value={`${d.score}% (${d.alertLevel})`} />
              ))}
            </div>
            {result.violations.length > 0 ? (
              <div className="pt-1">
                <p className="text-[11px] font-semibold text-destructive">Limites violados:</p>
                {result.violations.map((v, i) => (
                  <p key={i} className="text-[11px] text-destructive/80 pl-2">
                    - {v.label}: {v.score}% (minimo: {v.required}%) -- nivel {v.level}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-green-400">Nenhum limite violado.</p>
            )}
            <ArticleRef text='Artigo III, &sect;1 -- "Toda decisao relevante possui requisitos minimos de capacidade para ser executada com seguranca."' />
            <ArticleRef text='Artigo III, &sect;2 -- "A violacao de qualquer limite critico e suficiente para bloquear ou adiar uma decisao."' />
          </Section>

          {/* PASSO 4 — Prioridade e Gargalo */}
          <Section step={4} title="Prioridade e Gargalo Dominante">
            {result.readinessPlan ? (
              <>
                <DataRow label="Gargalo dominante" value={`${result.readinessPlan.primaryBottleneck.label} (${result.readinessPlan.primaryBottleneck.score}%)`} />
                {result.readinessPlan.secondaryBottleneck && (
                  <DataRow label="Gargalo secundario" value={`${result.readinessPlan.secondaryBottleneck.label} (${result.readinessPlan.secondaryBottleneck.score}%)`} />
                )}
              </>
            ) : (
              <p className="text-[11px] text-green-400">Nenhum gargalo critico identificado. Todos os dominios acima dos limites requeridos.</p>
            )}
            <ArticleRef text='Artigo IV, &sect;4 -- "O LifeOS deve identificar, a cada ciclo, o gargalo estrutural dominante."' />
            <ArticleRef text='Artigo IV, &sect;3 -- "Urgencia nao supera hierarquia. Retorno nao supera estrutura."' />
          </Section>

          {/* PASSO 5 — Cenários Simulados */}
          <Section step={5} title="Cenarios Simulados">
            {result.scenarios.map((s) => (
              <div key={s.id} className="rounded border border-border/50 p-2 space-y-0.5">
                <p className="text-[11px] font-semibold" style={{ color: s.color }}>{s.name}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <DataRow label="Carga lider" value={`${s.leaderLoad}%`} />
                  <DataRow label="Risco sistemico" value={`${s.systemicRisk}%`} />
                  <DataRow label="P(falha)" value={`${s.failureProbability}%`} />
                  <DataRow label="Meses ate tensao" value={`${s.monthsToTension}m`} />
                </div>
              </div>
            ))}
            <ArticleRef text='Artigo I, &sect;3 -- "Nenhuma expansao deve preceder o fortalecimento do vaso."' />
            <ArticleRef text='Artigo I, &sect;6 -- "Resultados imediatos nao invalidam riscos estruturais."' />
          </Section>

          {/* PASSO 6 — Veredito e Regra Determinante */}
          <Section step={6} title="Veredito e Regra Determinante">
            <div className="flex items-center gap-3 py-1">
              <span className="text-lg font-bold" style={{ color: isSim ? "#2B9348" : "#E8590C" }}>
                {result.verdict}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Score: {stateScore}% | Minimo: {dtConfig.minRequired}% | Gap: {result.gap}%
              </span>
            </div>
            {result.gap > 0 ? (
              <p className="text-[11px]">
                Regra aplicada: Gap estrutural de {result.gap}% entre capacidade atual ({stateScore}%) e exigida ({dtConfig.minRequired}%).
              </p>
            ) : (
              <p className="text-[11px]">
                Capacidade atual ({stateScore}%) atende o minimo exigido ({dtConfig.minRequired}%) para decisao {dtConfig.label.toLowerCase()}.
              </p>
            )}
            <ArticleRef text='Artigo II, &sect;3 -- "Nenhuma decisao relevante pode ser considerada segura sem compatibilidade explicita com o estado atual de capacidade."' />
            <ArticleRef text='Artigo II, &sect;5 -- "Projecoes futuras, oportunidades externas ou pressoes contextuais nao anulam o estado estrutural presente."' />
            <ArticleRef text='Artigo I, &sect;4 -- Regra de concordancia: O SIM so existe quando numeros E estrutura humana concordam.' />
          </Section>

          {/* PASSO 7 — Plano de Prontidão */}
          <Section step={7} title="Plano de Prontidao">
            {result.readinessPlan ? (
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-orange-400">Motivo estrutural</p>
                  <p className="text-[11px]">{result.readinessPlan.structuralReason}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-orange-400">Componente insuficiente</p>
                  <p className="text-[11px]">{result.readinessPlan.primaryBottleneck.label} -- {result.readinessPlan.primaryBottleneck.score}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-orange-400">Acoes prioritarias</p>
                  {result.readinessPlan.actions.map((a, i) => (
                    <p key={i} className="text-[11px] pl-2">- {a.action} ({a.horizon}) | Indicador: {a.indicator}</p>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-orange-400">Condicao de reavaliacao</p>
                  {result.readinessPlan.reevaluationTriggers.map((t, i) => (
                    <p key={i} className="text-[11px] pl-2">- {t}</p>
                  ))}
                </div>
                <DataRow label="Timeline estimada" value={result.readinessPlan.timeline} />
                <ArticleRef text='Artigo III, &sect;4 -- "Nenhum bloqueio pode ser emitido sem a apresentacao simultanea de um Plano de Prontidao."' />
                <ArticleRef text='Artigo III, &sect;5 -- Os planos devem ser "Especificos, Executaveis, Temporais, Mensuraveis."' />
                <ArticleRef text='Artigo III, &sect;6 -- "O LifeOS deve reavaliar decisoes bloqueadas sempre que os indicadores do plano forem atingidos."' />
              </div>
            ) : (
              <p className="text-[11px] text-green-400">
                Decisao aprovada. Nenhum Plano de Prontidao necessario. A capacidade atual e compativel com a decisao avaliada.
              </p>
            )}
          </Section>

          {/* Disclaimer */}
          <div className="border-t border-border pt-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Disclaimer</p>
            <ArticleRef text='Artigo VI, &sect;1 -- "O LifeOS orienta, governa e protege, mas nao substitui a responsabilidade final do individuo."' />
            <ArticleRef text='Artigo VI, &sect;3 -- "A autoridade do LifeOS e estrutural e tecnica, nao moral."' />
            <ArticleRef text='Artigo VI, &sect;4 -- "O LifeOS nao atua como conselho medico, juridico ou consultoria financeira especifica."' />
          </div>

          {/* Footer */}
          <p className="text-[9px] text-muted-foreground text-center pt-2">
            LifeOS -- Parecer de Governanca | Protocolo Luz & Vaso | Constituicao v{result.constitutionVersion}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ParecerConstitucional;
