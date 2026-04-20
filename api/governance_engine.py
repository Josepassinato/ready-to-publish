"""
LIFEOS — GOVERNANCE ENGINE · Python port (parity with TS src/lib/governance-engine.ts)
Protocolo Luz & Vaso · Constituição Artigos I–VII
Determinístico. Server-side. Sem IA.
A IA nunca decide fora das regras. Ela executa governo.
"""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Optional, TypedDict


# ── TYPES ─────────────────────────────────────────────────────────

class Assessment(TypedDict):
    energy: float
    clarity: float
    stress: float
    confidence: float
    load: float


class BusinessInput(TypedDict):
    revenue: float
    costs: float
    founderDependence: float
    activeFronts: float
    processMaturity: float
    delegationCapacity: float


class FinancialInput(TypedDict):
    revenue: float
    cash: float
    debt: float
    fixedCosts: float
    intendedLeverage: float


class RelationalInput(TypedDict):
    activeConflicts: float
    criticalDependencies: float
    partnerAlignment: float
    teamStability: float
    ecosystemHealth: float


DecisionTypeLiteral = Literal["existential", "structural", "strategic", "tactical"]
ImpactLiteral = Literal["transformational", "high", "medium", "low"]
ReversibilityLiteral = Literal["irreversible", "difficult", "moderate", "easy"]
UrgencyLiteral = Literal["critical", "high", "moderate", "low"]
ResourcesLiteral = Literal["massive", "significant", "moderate", "minimal"]


class Decision(TypedDict):
    description: str
    type: DecisionTypeLiteral
    impact: ImpactLiteral
    reversibility: ReversibilityLiteral
    urgency: UrgencyLiteral
    resourcesRequired: ResourcesLiteral


StateId = Literal[
    "active_failure", "insufficient", "failure_risk", "under_tension",
    "building", "stable", "controlled_expansion", "recovery",
]

DomainId = Literal["financial", "emotional", "decisional", "operational", "relational", "energetic"]


# ── CONSTITUTION (Immutable) ──────────────────────────────────────

CONSTITUTION_VERSION = "0.4.0"

STATES: list[dict] = [
    {"id": "active_failure",       "label": "Falha Estrutural Ativa",  "severity": 9, "color": "#E03131", "min": 0,  "max": 15},
    {"id": "insufficient",         "label": "Capacidade Insuficiente", "severity": 8, "color": "#E8590C", "min": 16, "max": 30},
    {"id": "failure_risk",         "label": "Risco de Falha",          "severity": 7, "color": "#D9780F", "min": 20, "max": 35},
    {"id": "under_tension",        "label": "Sob Tensão",              "severity": 5, "color": "#C09A1F", "min": 36, "max": 50},
    {"id": "recovery",             "label": "Recuperação Estrutural",  "severity": 4, "color": "#7C8A30", "min": 20, "max": 40},
    {"id": "building",             "label": "Em Construção",           "severity": 3, "color": "#6B9E3A", "min": 40, "max": 60},
    {"id": "stable",               "label": "Capacidade Estável",      "severity": 2, "color": "#2B9348", "min": 55, "max": 75},
    {"id": "controlled_expansion", "label": "Expansão Controlada",     "severity": 1, "color": "#0B7A4C", "min": 76, "max": 100},
]

VALID_TRANSITIONS: dict[str, list[str]] = {
    "active_failure":       ["recovery"],
    "insufficient":         ["building", "recovery"],
    "failure_risk":         ["active_failure", "recovery", "under_tension"],
    "under_tension":        ["stable", "failure_risk", "recovery"],
    "recovery":             ["building", "stable", "insufficient"],
    "building":             ["stable", "insufficient", "under_tension"],
    "stable":               ["controlled_expansion", "under_tension", "building"],
    "controlled_expansion": ["stable", "under_tension"],
}

DECISION_TYPES: list[dict] = [
    {"id": "existential", "label": "Existencial", "level": 1, "minOverall": 85, "minDomain": 70},
    {"id": "structural",  "label": "Estrutural",  "level": 2, "minOverall": 70, "minDomain": 55},
    {"id": "strategic",   "label": "Estratégica", "level": 3, "minOverall": 55, "minDomain": 40},
    {"id": "tactical",    "label": "Tática",      "level": 4, "minOverall": 35, "minDomain": 25},
]

DOMAINS: list[dict] = [
    {"id": "financial",   "label": "Financeira",  "weight": 0.20},
    {"id": "emotional",   "label": "Emocional",   "weight": 0.18},
    {"id": "decisional",  "label": "Decisória",   "weight": 0.17},
    {"id": "operational", "label": "Operacional", "weight": 0.18},
    {"id": "relational",  "label": "Relacional",  "weight": 0.13},
    {"id": "energetic",   "label": "Energética",  "weight": 0.14},
]

THRESHOLDS = {
    "preventive": [40, 55],
    "attention":  [25, 39],
    "critical":   [0, 24],
}

WEIGHTS = {
    "energy":     0.18,
    "clarity":    0.22,
    "stress":     0.20,  # inverted
    "confidence": 0.18,
    "load":       0.22,  # inverted
}


# ── HELPERS ───────────────────────────────────────────────────────

def _round_half_up(x: float) -> int:
    """JS-compatible Math.round: half-up for positives, half-down for negatives."""
    if x >= 0:
        return math.floor(x + 0.5)
    return -math.floor(-x + 0.5)


def _js_quantize(x: float, scale: int) -> float | int:
    """Mimic JS `Math.round(x * scale) / scale`: int when whole, float otherwise."""
    n = _round_half_up(x * scale)
    if n % scale == 0:
        return n // scale
    return n / scale


def clamp(v: float, lo: float = 0, hi: float = 100) -> int:
    return max(lo, min(hi, _round_half_up(v)))


def _new_uuid() -> str:
    return str(uuid.uuid4())


# ── MODULE 1: STATE CLASSIFIER ────────────────────────────────────

def classify_state(a: Assessment) -> dict:
    adjusted = {
        "energy":     a["energy"],
        "clarity":    a["clarity"],
        "stress":     100 - a["stress"],
        "confidence": a["confidence"],
        "load":       100 - a["load"],
    }

    score = clamp(
        adjusted["energy"] * WEIGHTS["energy"]
        + adjusted["clarity"] * WEIGHTS["clarity"]
        + adjusted["stress"] * WEIGHTS["stress"]
        + adjusted["confidence"] * WEIGHTS["confidence"]
        + adjusted["load"] * WEIGHTS["load"]
    )

    # Find matching state (sorted by min asc, first match where score fits)
    sorted_states = sorted(STATES, key=lambda s: s["min"])
    state = next((s for s in sorted_states if score >= s["min"] and score <= s["max"]), STATES[0])

    mid = (state["min"] + state["max"]) / 2
    dist_from_border = min(abs(score - state["min"]), abs(score - state["max"]))
    confidence = min(1.0, 0.5 + dist_from_border / 50)

    return {
        "state": state,
        "score": score,
        "confidence": _js_quantize(confidence, 100),
    }


# ── MODULE 2: 4-LAYER ANALYSIS ────────────────────────────────────

def analyze_human_layer(a: Assessment, state_score: int) -> dict:
    pressure_capacity = clamp(a["confidence"] * 0.3 + (100 - a["stress"]) * 0.4 + a["energy"] * 0.3)
    impulsivity_risk = clamp(a["stress"] * 0.4 + (100 - a["clarity"]) * 0.3 + a["load"] * 0.3)
    return {
        "score": state_score,
        "pressureCapacity": pressure_capacity,
        "impulsivityRisk": impulsivity_risk,
    }


def analyze_business_layer(b: BusinessInput) -> dict:
    margin = clamp(((b["revenue"] - b["costs"]) / b["revenue"]) * 100) if b["revenue"] > 0 else 0
    independence_score = 100 - b["founderDependence"]
    front_load = clamp(100 - (b["activeFronts"] - 1) * 12)
    score = clamp(
        margin * 0.25 + independence_score * 0.20 + front_load * 0.15
        + b["processMaturity"] * 0.20 + b["delegationCapacity"] * 0.20
    )
    complexity = clamp(
        b["activeFronts"] * 10 + b["founderDependence"] * 0.3 + (100 - b["processMaturity"]) * 0.3
    )
    return {"score": score, "margin": margin, "complexity": complexity}


def analyze_financial_layer(f: FinancialInput) -> dict:
    annual_revenue = max(f["revenue"] * 12, 1)
    leverage = f["debt"] / annual_revenue
    intended_leverage = (f["debt"] + f["intendedLeverage"]) / annual_revenue
    runway = f["cash"] / f["fixedCosts"] if f["fixedCosts"] > 0 else 99

    leverage_score = clamp(100 - leverage * 50)
    runway_score = clamp(min(100, runway * 15))
    cash_score = clamp((f["cash"] / f["revenue"]) * 30) if f["revenue"] > 0 else 0
    margin_score = clamp(((f["revenue"] - f["fixedCosts"]) / f["revenue"]) * 100) if f["revenue"] > 0 else 0

    score = clamp(leverage_score * 0.30 + runway_score * 0.25 + cash_score * 0.20 + margin_score * 0.25)
    tension_probability = clamp(min(95, max(5, (intended_leverage / 1.4) * 40)))

    return {
        "score": score,
        "leverage": _js_quantize(leverage, 100),
        "intendedLeverage": _js_quantize(intended_leverage, 100),
        "runway": _js_quantize(runway, 10),
        "tensionProbability": tension_probability,
    }


def analyze_relational_layer(r: RelationalInput) -> dict:
    conflict_penalty = r["activeConflicts"] * 8
    dependency_penalty = r["criticalDependencies"] * 5
    score = clamp(
        r["partnerAlignment"] * 0.30 + r["teamStability"] * 0.30
        + r["ecosystemHealth"] * 0.20 - conflict_penalty - dependency_penalty + 20
    )
    conflict_risk = clamp(r["activeConflicts"] * 12 + r["criticalDependencies"] * 8)
    return {"score": score, "conflictRisk": conflict_risk}


# ── MODULE 3: DOMAIN SCORES ───────────────────────────────────────

def compute_domain_scores(
    human: dict, business: dict, financial: dict, relational: dict, a: Assessment
) -> dict[DomainId, int]:
    return {
        "financial":   clamp(financial["score"]),
        "emotional":   clamp((100 - a["stress"]) * 0.5 + a["confidence"] * 0.3 + a["energy"] * 0.2),
        "decisional":  clamp(a["clarity"] * 0.4 + a["confidence"] * 0.3 + (100 - a["load"]) * 0.3),
        "operational": clamp(business["score"]),
        "relational":  clamp(relational["score"]),
        "energetic":   clamp(a["energy"] * 0.6 + (100 - a["load"]) * 0.4),
    }


# ── MODULE 4: THRESHOLD & BLOCK (Art. III) ────────────────────────

def check_thresholds(
    domain_scores: dict, decision_type: str, state_info: dict
) -> dict:
    type_config = next((t for t in DECISION_TYPES if t["id"] == decision_type), DECISION_TYPES[2])
    violations: list[dict] = []

    for domain in DOMAINS:
        score = domain_scores[domain["id"]]
        level: Optional[str] = None
        if score <= THRESHOLDS["critical"][1]:
            level = "critical"
        elif score <= THRESHOLDS["attention"][1]:
            level = "attention"
        elif score <= THRESHOLDS["preventive"][1]:
            level = "preventive"

        if level and score < type_config["minDomain"]:
            violations.append({
                "domain": domain["id"],
                "label": domain["label"],
                "score": score,
                "required": type_config["minDomain"],
                "level": level,
            })

    has_critical = any(v["level"] == "critical" for v in violations)
    state_too_weak = state_info["severity"] >= 5

    avg = sum(domain_scores.values()) / 6
    overall_too_low = avg < type_config["minOverall"]

    blocked = has_critical or state_too_weak or overall_too_low
    alert_level = "critical" if has_critical else ("attention" if violations else "ok")

    return {"blocked": blocked, "violations": violations, "alertLevel": alert_level}


# ── MODULE 5: SCENARIO SIMULATOR ──────────────────────────────────

def simulate_scenarios(
    human: dict, business: dict, financial: dict, relational: dict,
    fin: FinancialInput, gap: float,
) -> list[dict]:
    base = {
        "leaderLoad": clamp(100 - human["score"]),
        "systemicRisk": clamp(
            business["complexity"] * 0.4 + relational["conflictRisk"] * 0.3
            + (100 - financial["score"]) * 0.3
        ),
        "cashFlow": fin["revenue"] - fin["fixedCosts"],
    }

    configs = [
        {"id": "optimistic", "name": "Otimista",      "color": "#0B7A4C", "mult": 0.7, "cashMult": 1.15},
        {"id": "realistic",  "name": "Realista",     "color": "#2563EB", "mult": 1.0, "cashMult": 1.0},
        {"id": "stress",     "name": "Estresse",     "color": "#E8590C", "mult": 1.4, "cashMult": 0.7},
        {"id": "hfailure",   "name": "Falha Humana", "color": "#E03131", "mult": 1.8, "cashMult": 0.4},
    ]

    scenarios = []
    for cfg in configs:
        load = clamp(base["leaderLoad"] * cfg["mult"] + gap * 0.3)
        risk = clamp(base["systemicRisk"] * cfg["mult"])
        fail = clamp(min(95, risk * 0.6 + load * 0.4))
        month_flow = base["cashFlow"] * cfg["cashMult"]

        cash_projection = [
            {"month": m, "cash": _round_half_up(fin["cash"] + month_flow * m)}
            for m in range(13)
        ]

        # JS findIndex returns -1 if not found; Python equivalent
        break_month = next((i for i, p in enumerate(cash_projection) if p["cash"] < 0), -1)

        if break_month > 0:
            tension = break_month
        else:
            tension = max(1, round(12 / cfg["mult"]))

        scenarios.append({
            "id": cfg["id"],
            "name": cfg["name"],
            "color": cfg["color"],
            "leaderLoad": load,
            "systemicRisk": risk,
            "failureProbability": fail,
            "monthsToTension": tension,
            "complexityAdded": clamp(business["complexity"] * cfg["mult"] * 0.5),
            "cashProjection": cash_projection,
            "breakMonth": break_month if break_month > 0 else -1,
        })

    return scenarios


# ── MODULE 6: READINESS PLAN GENERATOR (Art. III) ─────────────────

ACTION_TEMPLATES: dict[str, list[dict]] = {
    "financial": [
        {"action": "Reduzir alavancagem para nível seguro",        "indicator": "Alavancagem < 1.4x"},
        {"action": "Estabilizar fluxo de caixa por 2 ciclos",      "indicator": "2 meses positivos consecutivos"},
        {"action": "Criar reserva de emergência de 3 meses",       "indicator": "Caixa ≥ 3x custos fixos"},
    ],
    "emotional": [
        {"action": "Reduzir fontes de estresse ativas",            "indicator": "Estresse auto-reportado < 50"},
        {"action": "Recuperar rotina de descanso cognitivo",       "indicator": "Energia auto-reportada > 60"},
    ],
    "decisional": [
        {"action": "Reduzir decisões paralelas por 30 dias",       "indicator": "Carga decisória < 40"},
        {"action": "Implementar processo de decisão estruturado",  "indicator": "Clareza > 65"},
    ],
    "operational": [
        {"action": "Reduzir frentes ativas simultâneas",           "indicator": "Frentes ativas ≤ 3"},
        {"action": "Aumentar maturidade de processos",             "indicator": "Processos > 60"},
        {"action": "Fortalecer capacidade de delegação",           "indicator": "Delegação > 60"},
    ],
    "relational": [
        {"action": "Resolver conflito ativo mais crítico",         "indicator": "Conflitos ativos ≤ 1"},
        {"action": "Alinhar expectativas com parceiros-chave",     "indicator": "Alinhamento > 65"},
    ],
    "energetic": [
        {"action": "Recuperar margem de energia e ritmo",          "indicator": "Energia > 60"},
        {"action": "Reduzir carga decisória excessiva",            "indicator": "Carga < 50"},
    ],
}


def generate_readiness_plan(
    domain_scores: dict, violations: list, decision_type: str,
    overall_score: int, gap: int,
) -> dict:
    type_config = next((t for t in DECISION_TYPES if t["id"] == decision_type), DECISION_TYPES[2])

    sorted_domains = sorted(
        [{**d, "score": domain_scores[d["id"]]} for d in DOMAINS],
        key=lambda d: d["score"],
    )
    primary = sorted_domains[0]
    secondary = sorted_domains[1] if len(sorted_domains) > 1 else None

    actions: list[dict] = []
    weak_domains = [d for d in sorted_domains if d["score"] < type_config["minDomain"]][:3]
    horizon_lo = max(2, round(gap / 5))
    horizon_hi = max(4, round(gap / 3))
    for domain in weak_domains:
        templates = ACTION_TEMPLATES.get(domain["id"], [])
        for t in templates[:2]:
            actions.append({
                "action": t["action"],
                "horizon": f"{horizon_lo}–{horizon_hi} semanas",
                "indicator": t["indicator"],
            })

    if len(actions) < 3:
        actions.append({
            "action": "Fortalecer capacidade geral antes de avançar",
            "horizon": "4–8 semanas",
            "indicator": f"Score geral ≥ {type_config['minOverall']}%",
        })

    triggers = [
        f"Score geral ≥ {type_config['minOverall']}%",
        f"{primary['label']} ≥ {type_config['minDomain']}% (atual: {primary['score']}%)",
    ]
    if secondary and secondary["score"] < type_config["minDomain"]:
        triggers.append(
            f"{secondary['label']} ≥ {type_config['minDomain']}% (atual: {secondary['score']}%)"
        )

    return {
        "structuralReason": (
            f"Esta decisão {type_config['label'].lower()} exige capacidade mínima de "
            f"{type_config['minOverall']}%. Seu score atual é {overall_score}%, gerando um gap de "
            f"{gap}%. O sistema identifica incompatibilidade estrutural, não opinião."
        ),
        "primaryBottleneck": {"domain": primary["id"], "label": primary["label"], "score": primary["score"]},
        "secondaryBottleneck": (
            {"domain": secondary["id"], "label": secondary["label"], "score": secondary["score"]}
            if secondary else None
        ),
        "actions": actions,
        "reevaluationTriggers": triggers,
        "timeline": f"{max(2, round(gap / 4))}–{max(4, round(gap / 2))} semanas",
    }


# ── MAIN PIPELINE ─────────────────────────────────────────────────

def govern(
    assessment: Assessment,
    business: BusinessInput,
    financial: FinancialInput,
    relational: RelationalInput,
    decision: Decision,
    previous_state_id: Optional[StateId] = None,
) -> dict:
    pipeline_id = _new_uuid()
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Step 1: State Classification
    cls = classify_state(assessment)
    state, state_score, confidence = cls["state"], cls["score"], cls["confidence"]

    # Transition validation
    transition_warning: Optional[str] = None
    if previous_state_id and previous_state_id != state["id"]:
        valid_targets = VALID_TRANSITIONS.get(previous_state_id, [])
        if state["id"] not in valid_targets:
            transition_warning = (
                f"Art. II: Transição {previous_state_id} → {state['id']} não é válida. "
                f"Transições permitidas: {', '.join(valid_targets)}. Pode indicar mudança abrupta."
            )

    # Step 2: 4-Layer Analysis
    human = analyze_human_layer(assessment, state_score)
    biz = analyze_business_layer(business)
    fin = analyze_financial_layer(financial)
    rel = analyze_relational_layer(relational)

    # Step 3: Domain Scores
    domain_scores = compute_domain_scores(human, biz, fin, rel, assessment)

    # Step 4: Decision Type
    type_config = next((t for t in DECISION_TYPES if t["id"] == decision["type"]), DECISION_TYPES[2])
    overall_score = clamp((human["score"] + biz["score"] + fin["score"] + rel["score"]) / 4)
    gap = max(0, type_config["minOverall"] - overall_score)

    # Step 5: Threshold Check
    th = check_thresholds(domain_scores, decision["type"], state)
    blocked, violations = th["blocked"], th["violations"]

    # Step 6: Scenarios
    scenarios = simulate_scenarios(human, biz, fin, rel, financial, gap)

    # Step 7: Verdict
    verdict = "NÃO AGORA" if blocked else "SIM"

    # Step 8: Readiness Plan
    readiness_plan = (
        generate_readiness_plan(domain_scores, violations, decision["type"], overall_score, gap)
        if blocked else None
    )

    # Domain details
    domain_details = []
    for d in DOMAINS:
        score = domain_scores[d["id"]]
        if score <= THRESHOLDS["critical"][1]:
            alert = "critical"
        elif score <= THRESHOLDS["attention"][1]:
            alert = "attention"
        elif score <= THRESHOLDS["preventive"][1]:
            alert = "preventive"
        else:
            alert = "ok"
        domain_details.append({"id": d["id"], "label": d["label"], "score": score, "alertLevel": alert})

    return {
        "pipelineId": pipeline_id,
        "timestamp": timestamp,
        "constitutionVersion": CONSTITUTION_VERSION,
        "verdict": verdict,
        "overallScore": overall_score,
        "gap": gap,
        "blocked": blocked,
        "state": state,
        "stateConfidence": confidence,
        "layers": {
            "human": human,
            "business": biz,
            "financial": fin,
            "relational": rel,
        },
        "domainScores": domain_scores,
        "domainDetails": domain_details,
        "violations": violations,
        "scenarios": scenarios,
        "readinessPlan": readiness_plan,
        "decisionType": {
            "id": type_config["id"],
            "label": type_config["label"],
            "level": type_config["level"],
            "minRequired": type_config["minOverall"],
        },
        "transitionWarning": transition_warning,
    }
