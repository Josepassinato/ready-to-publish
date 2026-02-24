import { useRef, useCallback } from "react";
import type { GovernanceResult } from "@/lib/governance-engine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface MindMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: GovernanceResult;
  decisionDescription?: string;
  userName?: string;
}

// ── Node component ────────────────────────────────────────────────

interface NodeProps {
  label: string;
  color: string;
  children?: React.ReactNode;
  className?: string;
}

const MNode = ({ label, color, children, className = "" }: NodeProps) => (
  <div
    className={`rounded-xl border px-3 py-2 text-xs leading-snug ${className}`}
    style={{ borderColor: color, backgroundColor: `${color}12` }}
  >
    <p className="font-semibold mb-1" style={{ color }}>{label}</p>
    {children && <div className="space-y-0.5 text-muted-foreground">{children}</div>}
  </div>
);

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between gap-2">
    <span>{label}</span>
    <span className="font-mono text-foreground">{value}</span>
  </div>
);

// ── Branch connector ──────────────────────────────────────────────

const Branch = ({ color, label, children }: { color: string; label: string; children: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="h-4 w-px" style={{ backgroundColor: color }} />
    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</div>
    <div className="h-2 w-px" style={{ backgroundColor: color }} />
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────

const MindMapModal = ({ open, onOpenChange, result, decisionDescription, userName }: MindMapModalProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const isSim = result.verdict === "SIM";
  const verdictColor = isSim ? "#2B9348" : "#E8590C";

  const exportAs = useCallback(async (format: "png" | "pdf") => {
    if (!mapRef.current) return;
    const canvas = await html2canvas(mapRef.current, {
      backgroundColor: "#0A1628",
      scale: 2,
      useCORS: true,
    });

    if (format === "png") {
      const link = document.createElement("a");
      link.download = `lifeos-mapa-decisao-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } else {
      const imgData = canvas.toDataURL("image/png");
      const w = canvas.width;
      const h = canvas.height;
      const ratio = w / h;
      const pdfW = 210;
      const pdfH = pdfW / ratio;
      const pdf = new jsPDF({ orientation: pdfH > pdfW ? "portrait" : "landscape", unit: "mm", format: [pdfW, pdfH + 20] });
      pdf.setFontSize(14);
      pdf.setTextColor(200, 200, 220);
      pdf.text("LifeOS -- Mapa de Decisao", 10, 12);
      pdf.setFontSize(8);
      pdf.text(`${new Date().toLocaleDateString("pt-BR")} | ${userName || ""}`, 10, 17);
      pdf.addImage(imgData, "PNG", 0, 20, pdfW, pdfH);
      pdf.save(`lifeos-mapa-decisao-${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  }, [userName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-background border-border p-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-base font-semibold text-foreground">Mapa Mental da Decisao</DialogTitle>
        </DialogHeader>

        {/* Export buttons */}
        <div className="flex gap-2 px-5">
          <Button variant="ghost" size="sm" className="h-9 min-h-[44px] border border-border/50 text-xs" onClick={() => exportAs("png")}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar PNG
          </Button>
          <Button variant="ghost" size="sm" className="h-9 min-h-[44px] border border-border/50 text-xs" onClick={() => exportAs("pdf")}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar PDF
          </Button>
        </div>

        {/* Mind map content */}
        <div ref={mapRef} className="px-5 pb-5 pt-2 space-y-1" style={{ backgroundColor: "#0A1628" }}>

          {/* ── CENTER: Decision ────────────────────────── */}
          <div className="flex justify-center">
            <div className="rounded-2xl border-2 border-primary px-5 py-3 text-center max-w-md" style={{ backgroundColor: "hsl(213 58% 45% / 0.1)" }}>
              <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Decisao Avaliada</p>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {decisionDescription || result.decisionType.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Tipo: {result.decisionType.label} | Min: {result.decisionType.minRequired}%</p>
            </div>
          </div>

          {/* ── GRID: 2 columns on md, 1 on mobile ─────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">

            {/* Ramo 1 — Camada Humana */}
            <Branch color="#3B82F6" label="Camada Humana">
              <MNode label="Humana" color="#3B82F6">
                <Metric label="Energia" value={`${result.layers.human.score}`} />
                <Metric label="Pressao" value={`${result.layers.human.pressureCapacity}%`} />
                <Metric label="Impulsividade" value={`${result.layers.human.impulsivityRisk}%`} />
                {result.domainScores && (
                  <>
                    <Metric label="Emocional" value={`${result.domainScores.emotional}`} />
                    <Metric label="Energetico" value={`${result.domainScores.energetic}`} />
                    <Metric label="Decisorio" value={`${result.domainScores.decisional}`} />
                  </>
                )}
              </MNode>
            </Branch>

            {/* Ramo 2 — Camada do Negócio */}
            <Branch color="#3B82F6" label="Camada do Negocio">
              <MNode label="Negocio" color="#3B82F6">
                <Metric label="Score" value={`${result.layers.business.score}`} />
                <Metric label="Margem" value={`${result.layers.business.margin}%`} />
                <Metric label="Complexidade" value={`${result.layers.business.complexity}`} />
                <Metric label="Operacional" value={`${result.domainScores.operational}`} />
              </MNode>
            </Branch>

            {/* Ramo 3 — Camada Financeira */}
            <Branch color="#3B82F6" label="Camada Financeira">
              <MNode label="Financeira" color="#3B82F6">
                <Metric label="Score" value={`${result.layers.financial.score}`} />
                <Metric label="Alavancagem" value={`${result.layers.financial.leverage}x`} />
                <Metric label="Runway" value={`${result.layers.financial.runway}m`} />
                <Metric label="P(Tensao)" value={`${result.layers.financial.tensionProbability}%`} />
              </MNode>
            </Branch>

            {/* Ramo 4 — Camada Relacional */}
            <Branch color="#3B82F6" label="Camada Relacional">
              <MNode label="Relacional" color="#3B82F6">
                <Metric label="Score" value={`${result.layers.relational.score}`} />
                <Metric label="Risco de Conflito" value={`${result.layers.relational.conflictRisk}%`} />
                <Metric label="Relacional" value={`${result.domainScores.relational}`} />
              </MNode>
            </Branch>
          </div>

          {/* ── Ramo 5 — Cenários Simulados ──────────── */}
          <Branch color="#A855F7" label="Cenarios Simulados">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
              {result.scenarios.map((s) => (
                <MNode key={s.id} label={s.name} color={s.color} className="text-center">
                  <Metric label="Carga" value={`${s.leaderLoad}%`} />
                  <Metric label="Risco" value={`${s.systemicRisk}%`} />
                  <Metric label="P(falha)" value={`${s.failureProbability}%`} />
                  <Metric label="Tensao" value={`${s.monthsToTension}m`} />
                </MNode>
              ))}
            </div>
          </Branch>

          {/* ── Ramo 6 — Veredito ────────────────────── */}
          <div className="flex justify-center pt-2">
            <div className="h-6 w-px" style={{ backgroundColor: verdictColor }} />
          </div>
          <div className="flex justify-center">
            <div
              className="rounded-2xl border-2 px-8 py-3 text-center"
              style={{ borderColor: verdictColor, backgroundColor: `${verdictColor}18` }}
            >
              <p className="text-[10px] uppercase tracking-wider" style={{ color: verdictColor }}>Veredito</p>
              <p className="text-2xl font-bold" style={{ color: verdictColor }}>{result.verdict}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Score: {result.overallScore}% | Gap: {result.gap}%</p>
            </div>
          </div>

          {/* ── Ramo 7 — Plano de Prontidão (se NÃO AGORA) ── */}
          {result.readinessPlan && (
            <>
              <div className="flex justify-center">
                <div className="h-4 w-px bg-orange-500" />
              </div>
              <MNode label="Plano de Prontidao" color="#E8590C">
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-orange-400">Motivo Estrutural</p>
                    <p className="text-[11px]">{result.readinessPlan.structuralReason}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-400">Componente Insuficiente</p>
                    <p className="text-[11px]">{result.readinessPlan.primaryBottleneck.label} ({result.readinessPlan.primaryBottleneck.score}%)</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-400">Acoes Prioritarias</p>
                    <ul className="space-y-0.5">
                      {result.readinessPlan.actions.map((a, i) => (
                        <li key={i} className="text-[11px] flex gap-1">
                          <span className="text-orange-400 shrink-0">-</span>
                          <span>{a.action} <span className="text-muted-foreground">({a.horizon})</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-400">Condicao de Reavaliacao</p>
                    <ul className="space-y-0.5">
                      {result.readinessPlan.reevaluationTriggers.map((t, i) => (
                        <li key={i} className="text-[11px]">- {t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </MNode>
            </>
          )}

          {/* Violations */}
          {result.violations.length > 0 && (
            <>
              <div className="flex justify-center pt-1">
                <div className="h-3 w-px bg-red-500" />
              </div>
              <MNode label={`${result.violations.length} Violacoes`} color="#E03131">
                {result.violations.map((v, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{v.label}</span>
                    <span className="font-mono text-red-400">{v.score}% <span className="text-muted-foreground">/ {v.required}%</span></span>
                  </div>
                ))}
              </MNode>
            </>
          )}

          {/* Footer */}
          <p className="text-[9px] text-muted-foreground text-center pt-3">
            LifeOS -- Mapa de Decisao | {new Date().toLocaleDateString("pt-BR")} | Constituicao Art. I-VII
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MindMapModal;
