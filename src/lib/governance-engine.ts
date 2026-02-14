// ═══════════════════════════════════════════════════════════════════
//  LIFEOS — GOVERNANCE ENGINE · TypeScript
//  Protocolo Luz & Vaso · Constituição Artigos I–VII
//  Determinístico. Client-side. Sem IA.
//  A IA nunca decide fora das regras. Ela executa governo.
// ═══════════════════════════════════════════════════════════════════

// ── TYPES ─────────────────────────────────────────────────────────

export interface Assessment {
  energy: number;      // 0-100
  clarity: number;     // 0-100
  stress: number;      // 0-100 (alto = ruim)
  confidence: number;  // 0-100
  load: number;        // 0-100 (alto = ruim)
}

export interface BusinessInput {
  revenue: number;         // R$/mês
  costs: number;           // R$/mês
  founderDependence: number; // 0-100
  activeFronts: number;    // 1-10
  processMaturity: number; // 0-100
  delegationCapacity: number; // 0-100
}

export interface FinancialInput {
  revenue: number;         // R$/mês
  cash: number;            // R$ disponível
  debt: number;            // R$ total
  fixedCosts: number;      // R$/mês
  intendedLeverage: number; // R$ pretendido
}

export interface RelationalInput {
  activeConflicts: number;       // 0-10
  criticalDependencies: number;  // 0-10
  partnerAlignment: number;      // 0-100
  teamStability: number;         // 0-100
  ecosystemHealth: number;       // 0-100
}

export interface Decision {
  description: string;
  type: "existential" | "structural" | "strategic" | "tactical";
  impact: "transformational" | "high" | "medium" | "low";
  reversibility: "irreversible" | "difficult" | "moderate" | "easy";
  urgency: "critical" | "high" | "moderate" | "low";
  resourcesRequired: "massive" | "significant" | "moderate" | "minimal";
}

export type StateId = "active_failure" | "insufficient" | "failure_risk" |
  "under_tension" | "building" | "stable" | "controlled_expansion" | "recovery";

export interface StateInfo {
  id: StateId;
  label: string;
  severity: number;
  color: string;
  min: number;
  max: number;
}

export type DomainId = "financial" | "emotional" | "decisional" | "operational" | "relational" | "energetic";

export interface DomainScore {
  id: DomainId;
  label: string;
  score: number;
  alertLevel: "ok" | "preventive" | "attention" | "critical";
}

export interface Scenario {
  id: string;
  name: string;
  color: string;
  leaderLoad: number;
  systemicRisk: number;
  failureProbability: number;
  monthsToTension: number;
  complexityAdded: number;
  cashProjection: { month: number; cash: number }[];
  breakMonth: number;
}

export interface ReadinessPlan {
  structuralReason: string;
  primaryBottleneck: { domain: string; label: string; score: number };
  secondaryBottleneck: { domain: string; label: string; score: number } | null;
  actions: { action: string; horizon: string; indicator: string }[];
  reevaluationTriggers: string[];
  timeline: string;
}

export interface Violation {
  domain: DomainId;
  label: string;
  score: number;
  required: number;
  level: "preventive" | "attention" | "critical";
}

export interface GovernanceResult {
  pipelineId: string;
  timestamp: string;
  constitutionVersion: string;

  verdict: "SIM" | "NÃO AGORA";
  overallScore: number;
  gap: number;
  blocked: boolean;

  state: StateInfo;
  stateConfidence: number;

  layers: {
    human: { score: number; pressureCapacity: number; impulsivityRisk: number };
    business: { score: number; margin: number; complexity: number };
    financial: { score: number; leverage: number; intendedLeverage: number; runway: number; tensionProbability: number };
    relational: { score: number; conflictRisk: number };
  };

  domainScores: Record<DomainId, number>;
  domainDetails: DomainScore[];
  violations: Violation[];

  scenarios: Scenario[];
  readinessPlan: ReadinessPlan | null;

  decisionType: { id: string; label: string; level: number; minRequired: number };
  transitionWarning: string | null;
}

// ── CONSTITUTION (Immutable) ──────────────────────────────────────

const CONSTITUTION_VERSION = "0.4.0";

const STATES: StateInfo[] = [
  { id: "active_failure",       label: "Falha Estrutural Ativa",  severity: 9, color: "#E03131", min: 0,  max: 15 },
  { id: "insufficient",         label: "Capacidade Insuficiente", severity: 8, color: "#E8590C", min: 16, max: 30 },
  { id: "failure_risk",         label: "Risco de Falha",          severity: 7, color: "#D9780F", min: 20, max: 35 },
  { id: "under_tension",        label: "Sob Tensão",              severity: 5, color: "#C09A1F", min: 36, max: 50 },
  { id: "recovery",             label: "Recuperação Estrutural",  severity: 4, color: "#7C8A30", min: 20, max: 40 },
  { id: "building",             label: "Em Construção",           severity: 3, color: "#6B9E3A", min: 40, max: 60 },
  { id: "stable",               label: "Capacidade Estável",      severity: 2, color: "#2B9348", min: 55, max: 75 },
  { id: "controlled_expansion", label: "Expansão Controlada",     severity: 1, color: "#0B7A4C", min: 76, max: 100 },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  active_failure: ["recovery"],
  insufficient: ["building", "recovery"],
  failure_risk: ["active_failure", "recovery", "under_tension"],
  under_tension: ["stable", "failure_risk", "recovery"],
  recovery: ["building", "stable", "insufficient"],
  building: ["stable", "insufficient", "under_tension"],
  stable: ["controlled_expansion", "under_tension", "building"],
  controlled_expansion: ["stable", "under_tension"],
};

const DECISION_TYPES = [
  { id: "existential",  label: "Existencial",  level: 1, minOverall: 85, minDomain: 70 },
  { id: "structural",   label: "Estrutural",    level: 2, minOverall: 70, minDomain: 55 },
  { id: "strategic",    label: "Estratégica",   level: 3, minOverall: 55, minDomain: 40 },
  { id: "tactical",     label: "Tática",        level: 4, minOverall: 35, minDomain: 25 },
];

const DOMAINS: { id: DomainId; label: string; weight: number }[] = [
  { id: "financial",   label: "Financeira",   weight: 0.20 },
  { id: "emotional",   label: "Emocional",    weight: 0.18 },
  { id: "decisional",  label: "Decisória",    weight: 0.17 },
  { id: "operational",  label: "Operacional",  weight: 0.18 },
  { id: "relational",  label: "Relacional",   weight: 0.13 },
  { id: "energetic",   label: "Energética",   weight: 0.14 },
];

const THRESHOLDS = { preventive: [40, 55], attention: [25, 39], critical: [0, 24] } as const;

// ── CLASSIFICATION WEIGHTS (Art. II) ──────────────────────────────

const WEIGHTS = {
  energy: 0.18,
  clarity: 0.22,
  stress: 0.20,   // inverted
  confidence: 0.18,
  load: 0.22,      // inverted
};

// ── HELPER ────────────────────────────────────────────────────────

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(v)));
const uuid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── MODULE 1: STATE CLASSIFIER ────────────────────────────────────

function classifyState(a: Assessment): { state: StateInfo; score: number; confidence: number } {
  const adjusted = {
    energy: a.energy,
    clarity: a.clarity,
    stress: 100 - a.stress,
    confidence: a.confidence,
    load: 100 - a.load,
  };

  const score = clamp(
    adjusted.energy * WEIGHTS.energy +
    adjusted.clarity * WEIGHTS.clarity +
    adjusted.stress * WEIGHTS.stress +
    adjusted.confidence * WEIGHTS.confidence +
    adjusted.load * WEIGHTS.load
  );

  // Find matching state (ordered by severity desc → first match where score fits)
  const sorted = [...STATES].sort((a, b) => a.min - b.min);
  const state = sorted.find(s => score >= s.min && score <= s.max) ?? STATES[0];

  // Confidence: higher when clearly inside range
  const mid = (state.min + state.max) / 2;
  const distFromBorder = Math.min(Math.abs(score - state.min), Math.abs(score - state.max));
  const confidence = Math.min(1.0, 0.5 + distFromBorder / 50);

  return { state, score, confidence: Math.round(confidence * 100) / 100 };
}

// ── MODULE 2: 4-LAYER ANALYSIS ────────────────────────────────────

function analyzeHumanLayer(a: Assessment, stateScore: number) {
  const pressureCapacity = clamp(a.confidence * 0.3 + (100 - a.stress) * 0.4 + a.energy * 0.3);
  const impulsivityRisk = clamp(a.stress * 0.4 + (100 - a.clarity) * 0.3 + a.load * 0.3);
  return { score: stateScore, pressureCapacity, impulsivityRisk };
}

function analyzeBusinessLayer(b: BusinessInput) {
  const margin = b.revenue > 0 ? clamp(((b.revenue - b.costs) / b.revenue) * 100) : 0;
  const independenceScore = 100 - b.founderDependence;
  const frontLoad = clamp(100 - (b.activeFronts - 1) * 12);
  const score = clamp(
    margin * 0.25 + independenceScore * 0.20 + frontLoad * 0.15 +
    b.processMaturity * 0.20 + b.delegationCapacity * 0.20
  );
  const complexity = clamp(b.activeFronts * 10 + b.founderDependence * 0.3 + (100 - b.processMaturity) * 0.3);
  return { score, margin, complexity };
}

function analyzeFinancialLayer(f: FinancialInput) {
  const annualRevenue = Math.max(f.revenue * 12, 1);
  const leverage = f.debt / annualRevenue;
  const intendedLeverage = (f.debt + f.intendedLeverage) / annualRevenue;
  const runway = f.fixedCosts > 0 ? f.cash / f.fixedCosts : 99;

  const leverageScore = clamp(100 - leverage * 50);
  const runwayScore = clamp(Math.min(100, runway * 15));
  const cashScore = f.revenue > 0 ? clamp((f.cash / f.revenue) * 30) : 0;
  const marginScore = f.revenue > 0 ? clamp(((f.revenue - f.fixedCosts) / f.revenue) * 100) : 0;

  const score = clamp(leverageScore * 0.30 + runwayScore * 0.25 + cashScore * 0.20 + marginScore * 0.25);
  const tensionProbability = clamp(Math.min(95, Math.max(5, (intendedLeverage / 1.4) * 40)));

  return {
    score,
    leverage: Math.round(leverage * 100) / 100,
    intendedLeverage: Math.round(intendedLeverage * 100) / 100,
    runway: Math.round(runway * 10) / 10,
    tensionProbability,
  };
}

function analyzeRelationalLayer(r: RelationalInput) {
  const conflictPenalty = r.activeConflicts * 8;
  const dependencyPenalty = r.criticalDependencies * 5;
  const score = clamp(
    r.partnerAlignment * 0.30 + r.teamStability * 0.30 +
    r.ecosystemHealth * 0.20 - conflictPenalty - dependencyPenalty + 20
  );
  const conflictRisk = clamp(r.activeConflicts * 12 + r.criticalDependencies * 8);
  return { score, conflictRisk };
}

// ── MODULE 3: DOMAIN SCORES ───────────────────────────────────────

function computeDomainScores(
  human: ReturnType<typeof analyzeHumanLayer>,
  business: ReturnType<typeof analyzeBusinessLayer>,
  financial: ReturnType<typeof analyzeFinancialLayer>,
  relational: ReturnType<typeof analyzeRelationalLayer>,
  a: Assessment
): Record<DomainId, number> {
  return {
    financial: clamp(financial.score),
    emotional: clamp(((100 - a.stress) * 0.5 + a.confidence * 0.3 + a.energy * 0.2)),
    decisional: clamp((a.clarity * 0.4 + a.confidence * 0.3 + (100 - a.load) * 0.3)),
    operational: clamp(business.score),
    relational: clamp(relational.score),
    energetic: clamp((a.energy * 0.6 + (100 - a.load) * 0.4)),
  };
}

// ── MODULE 4: THRESHOLD & BLOCK (Art. III) ────────────────────────

function checkThresholds(
  domainScores: Record<DomainId, number>,
  decisionType: string,
  stateInfo: StateInfo
): { blocked: boolean; violations: Violation[]; alertLevel: string } {
  const typeConfig = DECISION_TYPES.find(t => t.id === decisionType) ?? DECISION_TYPES[2];
  const violations: Violation[] = [];

  // Check each domain
  for (const domain of DOMAINS) {
    const score = domainScores[domain.id];
    let level: Violation["level"] | null = null;

    if (score <= THRESHOLDS.critical[1]) level = "critical";
    else if (score <= THRESHOLDS.attention[1]) level = "attention";
    else if (score <= THRESHOLDS.preventive[1]) level = "preventive";

    if (level && score < typeConfig.minDomain) {
      violations.push({
        domain: domain.id,
        label: domain.label,
        score,
        required: typeConfig.minDomain,
        level,
      });
    }
  }

  // Block if: any critical violation OR state severity too high
  const hasCritical = violations.some(v => v.level === "critical");
  const stateTooWeak = stateInfo.severity >= 5;

  // Block if overall too low for decision type
  const avg = Object.values(domainScores).reduce((s, v) => s + v, 0) / 6;
  const overallTooLow = avg < typeConfig.minOverall;

  const blocked = hasCritical || stateTooWeak || overallTooLow;

  const alertLevel = hasCritical ? "critical" : violations.length > 0 ? "attention" : "ok";

  return { blocked, violations, alertLevel };
}

// ── MODULE 5: SCENARIO SIMULATOR ──────────────────────────────────

function simulateScenarios(
  human: ReturnType<typeof analyzeHumanLayer>,
  business: ReturnType<typeof analyzeBusinessLayer>,
  financial: ReturnType<typeof analyzeFinancialLayer>,
  relational: ReturnType<typeof analyzeRelationalLayer>,
  fin: FinancialInput,
  gap: number
): Scenario[] {
  const base = {
    leaderLoad: clamp(100 - human.score),
    systemicRisk: clamp(business.complexity * 0.4 + relational.conflictRisk * 0.3 + (100 - financial.score) * 0.3),
    cashFlow: fin.revenue - fin.fixedCosts,
  };

  const configs = [
    { id: "optimistic", name: "Otimista",      color: "#0B7A4C", mult: 0.7, cashMult: 1.15 },
    { id: "realistic",  name: "Realista",       color: "#2563EB", mult: 1.0, cashMult: 1.0 },
    { id: "stress",     name: "Estresse",       color: "#E8590C", mult: 1.4, cashMult: 0.7 },
    { id: "hfailure",   name: "Falha Humana",   color: "#E03131", mult: 1.8, cashMult: 0.4 },
  ];

  return configs.map(cfg => {
    const load = clamp(base.leaderLoad * cfg.mult + gap * 0.3);
    const risk = clamp(base.systemicRisk * cfg.mult);
    const fail = clamp(Math.min(95, risk * 0.6 + load * 0.4));
    const monthFlow = base.cashFlow * cfg.cashMult;

    const cashProjection = Array.from({ length: 13 }, (_, m) => ({
      month: m,
      cash: Math.round(fin.cash + monthFlow * m),
    }));

    const breakMonth = cashProjection.findIndex(p => p.cash < 0);
    const tension = breakMonth > 0 ? breakMonth : Math.max(1, Math.round(12 / cfg.mult));

    return {
      id: cfg.id,
      name: cfg.name,
      color: cfg.color,
      leaderLoad: load,
      systemicRisk: risk,
      failureProbability: fail,
      monthsToTension: tension,
      complexityAdded: clamp(business.complexity * cfg.mult * 0.5),
      cashProjection,
      breakMonth: breakMonth > 0 ? breakMonth : -1,
    };
  });
}

// ── MODULE 6: READINESS PLAN GENERATOR (Art. III) ─────────────────

function generateReadinessPlan(
  domainScores: Record<DomainId, number>,
  violations: Violation[],
  decisionType: string,
  overallScore: number,
  gap: number
): ReadinessPlan {
  const typeConfig = DECISION_TYPES.find(t => t.id === decisionType) ?? DECISION_TYPES[2];

  // Sort domains by score (worst first)
  const sorted = DOMAINS.map(d => ({
    ...d, score: domainScores[d.id],
  })).sort((a, b) => a.score - b.score);

  const primary = sorted[0];
  const secondary = sorted[1] || null;

  // Generate actions based on weakest domains
  const actions: ReadinessPlan["actions"] = [];

  const actionTemplates: Record<DomainId, { action: string; indicator: string }[]> = {
    financial: [
      { action: "Reduzir alavancagem para nível seguro", indicator: "Alavancagem < 1.4x" },
      { action: "Estabilizar fluxo de caixa por 2 ciclos", indicator: "2 meses positivos consecutivos" },
      { action: "Criar reserva de emergência de 3 meses", indicator: "Caixa ≥ 3x custos fixos" },
    ],
    emotional: [
      { action: "Reduzir fontes de estresse ativas", indicator: "Estresse auto-reportado < 50" },
      { action: "Recuperar rotina de descanso cognitivo", indicator: "Energia auto-reportada > 60" },
    ],
    decisional: [
      { action: "Reduzir decisões paralelas por 30 dias", indicator: "Carga decisória < 40" },
      { action: "Implementar processo de decisão estruturado", indicator: "Clareza > 65" },
    ],
    operational: [
      { action: "Reduzir frentes ativas simultâneas", indicator: "Frentes ativas ≤ 3" },
      { action: "Aumentar maturidade de processos", indicator: "Processos > 60" },
      { action: "Fortalecer capacidade de delegação", indicator: "Delegação > 60" },
    ],
    relational: [
      { action: "Resolver conflito ativo mais crítico", indicator: "Conflitos ativos ≤ 1" },
      { action: "Alinhar expectativas com parceiros-chave", indicator: "Alinhamento > 65" },
    ],
    energetic: [
      { action: "Recuperar margem de energia e ritmo", indicator: "Energia > 60" },
      { action: "Reduzir carga decisória excessiva", indicator: "Carga < 50" },
    ],
  };

  // Add actions for worst 2-3 domains
  const weakDomains = sorted.filter(d => d.score < typeConfig.minDomain).slice(0, 3);
  for (const domain of weakDomains) {
    const templates = actionTemplates[domain.id] || [];
    for (const t of templates.slice(0, 2)) {
      actions.push({
        action: t.action,
        horizon: `${Math.max(2, Math.round(gap / 5))}–${Math.max(4, Math.round(gap / 3))} semanas`,
        indicator: t.indicator,
      });
    }
  }

  // Ensure at least 3 actions
  if (actions.length < 3) {
    actions.push({
      action: "Fortalecer capacidade geral antes de avançar",
      horizon: "4–8 semanas",
      indicator: `Score geral ≥ ${typeConfig.minOverall}%`,
    });
  }

  const triggers = [
    `Score geral ≥ ${typeConfig.minOverall}%`,
    `${primary.label} ≥ ${typeConfig.minDomain}% (atual: ${primary.score}%)`,
  ];
  if (secondary && secondary.score < typeConfig.minDomain) {
    triggers.push(`${secondary.label} ≥ ${typeConfig.minDomain}% (atual: ${secondary.score}%)`);
  }

  return {
    structuralReason: `Esta decisão ${typeConfig.label.toLowerCase()} exige capacidade mínima de ${typeConfig.minOverall}%. Seu score atual é ${overallScore}%, gerando um gap de ${gap}%. O sistema identifica incompatibilidade estrutural, não opinião.`,
    primaryBottleneck: { domain: primary.id, label: primary.label, score: primary.score },
    secondaryBottleneck: secondary ? { domain: secondary.id, label: secondary.label, score: secondary.score } : null,
    actions,
    reevaluationTriggers: triggers,
    timeline: `${Math.max(2, Math.round(gap / 4))}–${Math.max(4, Math.round(gap / 2))} semanas`,
  };
}

// ── MAIN PIPELINE ─────────────────────────────────────────────────

export function govern(
  assessment: Assessment,
  business: BusinessInput,
  financial: FinancialInput,
  relational: RelationalInput,
  decision: Decision,
  previousStateId?: StateId
): GovernanceResult {
  const pipelineId = uuid();
  const timestamp = new Date().toISOString();

  // Step 1: State Classification (Art. II)
  const { state, score: stateScore, confidence } = classifyState(assessment);

  // Transition validation
  let transitionWarning: string | null = null;
  if (previousStateId && previousStateId !== state.id) {
    const validTargets = VALID_TRANSITIONS[previousStateId] || [];
    if (!validTargets.includes(state.id)) {
      transitionWarning = `Art. II: Transição ${previousStateId} → ${state.id} não é válida. Transições permitidas: ${validTargets.join(", ")}. Pode indicar mudança abrupta.`;
    }
  }

  // Step 2: 4-Layer Analysis
  const humanLayer = analyzeHumanLayer(assessment, stateScore);
  const businessLayer = analyzeBusinessLayer(business);
  const financialLayer = analyzeFinancialLayer(financial);
  const relationalLayer = analyzeRelationalLayer(relational);

  // Step 3: Domain Scores
  const domainScores = computeDomainScores(humanLayer, businessLayer, financialLayer, relationalLayer, assessment);

  // Step 4: Decision Type
  const typeConfig = DECISION_TYPES.find(t => t.id === decision.type) ?? DECISION_TYPES[2];
  const overallScore = clamp(
    (humanLayer.score + businessLayer.score + financialLayer.score + relationalLayer.score) / 4
  );
  const gap = Math.max(0, typeConfig.minOverall - overallScore);

  // Step 5: Threshold Check (Art. III)
  const { blocked, violations, alertLevel } = checkThresholds(domainScores, decision.type, state);

  // Step 6: Scenarios
  const scenarios = simulateScenarios(humanLayer, businessLayer, financialLayer, relationalLayer, financial, gap);

  // Step 7: Verdict — SIM only when numbers AND structure agree (C7)
  const verdict: "SIM" | "NÃO AGORA" = blocked ? "NÃO AGORA" : "SIM";

  // Step 8: Readiness Plan (mandatory if blocked — C2)
  const readinessPlan = blocked
    ? generateReadinessPlan(domainScores, violations, decision.type, overallScore, gap)
    : null;

  // Domain details for UI
  const domainDetails: DomainScore[] = DOMAINS.map(d => {
    const score = domainScores[d.id];
    let alertLevel: DomainScore["alertLevel"] = "ok";
    if (score <= THRESHOLDS.critical[1]) alertLevel = "critical";
    else if (score <= THRESHOLDS.attention[1]) alertLevel = "attention";
    else if (score <= THRESHOLDS.preventive[1]) alertLevel = "preventive";
    return { id: d.id, label: d.label, score, alertLevel };
  });

  return {
    pipelineId,
    timestamp,
    constitutionVersion: CONSTITUTION_VERSION,
    verdict,
    overallScore,
    gap,
    blocked,
    state,
    stateConfidence: confidence,
    layers: {
      human: humanLayer,
      business: businessLayer,
      financial: financialLayer,
      relational: relationalLayer,
    },
    domainScores,
    domainDetails,
    violations,
    scenarios,
    readinessPlan,
    decisionType: {
      id: typeConfig.id,
      label: typeConfig.label,
      level: typeConfig.level,
      minRequired: typeConfig.minOverall,
    },
    transitionWarning,
  };
}

// ── EXPORTS FOR LOVABLE ───────────────────────────────────────────

export { STATES, DOMAINS, DECISION_TYPES, VALID_TRANSITIONS, THRESHOLDS, CONSTITUTION_VERSION };
export { classifyState, checkThresholds, simulateScenarios, generateReadinessPlan };
