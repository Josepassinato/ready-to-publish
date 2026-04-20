"""Parity port of src/test/governance-engine.test.ts (55 cases)."""
import math

import pytest

from api.governance_engine import (
    CONSTITUTION_VERSION,
    DECISION_TYPES,
    DOMAINS,
    STATES,
    THRESHOLDS,
    VALID_TRANSITIONS,
    check_thresholds,
    classify_state,
    generate_readiness_plan,
    govern,
    simulate_scenarios,
)


# ── FIXTURES ────────────────────────────────────────────────────────

strong_assessment = {"energy": 80, "clarity": 85, "stress": 20, "confidence": 80, "load": 20}
weak_assessment   = {"energy": 15, "clarity": 10, "stress": 90, "confidence": 10, "load": 95}
medium_assessment = {"energy": 50, "clarity": 55, "stress": 50, "confidence": 50, "load": 50}

strong_business = {"revenue": 50000, "costs": 20000, "founderDependence": 20,
                   "activeFronts": 2, "processMaturity": 80, "delegationCapacity": 75}
weak_business   = {"revenue": 5000, "costs": 8000, "founderDependence": 90,
                   "activeFronts": 8, "processMaturity": 10, "delegationCapacity": 10}

strong_financial = {"revenue": 50000, "cash": 200000, "debt": 10000,
                    "fixedCosts": 15000, "intendedLeverage": 0}
weak_financial   = {"revenue": 5000, "cash": 2000, "debt": 100000,
                    "fixedCosts": 8000, "intendedLeverage": 50000}

strong_relational = {"activeConflicts": 0, "criticalDependencies": 1,
                     "partnerAlignment": 85, "teamStability": 90, "ecosystemHealth": 80}
weak_relational   = {"activeConflicts": 8, "criticalDependencies": 7,
                     "partnerAlignment": 15, "teamStability": 10, "ecosystemHealth": 10}

tactical_decision    = {"description": "Comprar novo software de gestão",
                        "type": "tactical", "impact": "low", "reversibility": "easy",
                        "urgency": "low", "resourcesRequired": "minimal"}
existential_decision = {"description": "Pivotar modelo de negócio",
                        "type": "existential", "impact": "transformational",
                        "reversibility": "irreversible", "urgency": "high",
                        "resourcesRequired": "massive"}
strategic_decision   = {"description": "Expandir para novo mercado",
                        "type": "strategic", "impact": "high",
                        "reversibility": "difficult", "urgency": "moderate",
                        "resourcesRequired": "significant"}


# ── CONSTITUTION INTEGRITY (Art. I) ─────────────────────────────────

class TestConstitutionIntegrity:
    def test_version(self):
        assert CONSTITUTION_VERSION == "0.4.0"

    def test_exactly_8_states(self):
        assert len(STATES) == 8

    def test_exactly_6_domains(self):
        assert len(DOMAINS) == 6

    def test_exactly_4_decision_types(self):
        assert len(DECISION_TYPES) == 4

    def test_domain_weights_sum_to_1(self):
        total = sum(d["weight"] for d in DOMAINS)
        assert math.isclose(total, 1.0, abs_tol=0.01)

    def test_state_ranges_cover_0_to_100(self):
        sorted_states = sorted(STATES, key=lambda s: s["min"])
        assert sorted_states[0]["min"] == 0
        assert sorted_states[-1]["max"] == 100
        for s in range(0, 101):
            assert any(st["min"] <= s <= st["max"] for st in STATES)

    def test_states_is_stable_array(self):
        assert isinstance(STATES, list)
        for s in STATES:
            assert "id" in s and "min" in s and "max" in s and "severity" in s

    def test_decision_types_is_stable_array(self):
        assert isinstance(DECISION_TYPES, list)
        for dt in DECISION_TYPES:
            assert "id" in dt and "minOverall" in dt and "minDomain" in dt

    def test_valid_transitions_is_record(self):
        assert isinstance(VALID_TRANSITIONS, dict)
        for k, v in VALID_TRANSITIONS.items():
            assert isinstance(v, list)

    def test_transitions_for_all_8_states(self):
        for sid in (s["id"] for s in STATES):
            assert sid in VALID_TRANSITIONS
            assert isinstance(VALID_TRANSITIONS[sid], list)


# ── STATE CLASSIFIER (Art. I + II) ──────────────────────────────────

class TestStateClassification:
    def test_strong_is_high_state(self):
        cls = classify_state(strong_assessment)
        assert cls["score"] >= 66
        assert cls["state"]["id"] in ("stable", "controlled_expansion")

    def test_weak_is_low_state(self):
        cls = classify_state(weak_assessment)
        assert cls["score"] <= 25
        assert cls["state"]["id"] in ("active_failure", "insufficient")

    def test_medium_is_midrange(self):
        cls = classify_state(medium_assessment)
        assert 26 <= cls["score"] <= 65

    def test_score_between_0_and_100(self):
        extreme = {"energy": 0, "clarity": 0, "stress": 100, "confidence": 0, "load": 100}
        low = classify_state(extreme)["score"]
        assert 0 <= low <= 100
        max_a = {"energy": 100, "clarity": 100, "stress": 0, "confidence": 100, "load": 0}
        high = classify_state(max_a)["score"]
        assert 0 <= high <= 100

    def test_inverts_stress(self):
        low_stress = {"energy": 50, "clarity": 50, "stress": 10, "confidence": 50, "load": 50}
        high_stress = {"energy": 50, "clarity": 50, "stress": 90, "confidence": 50, "load": 50}
        s1 = classify_state(low_stress)["score"]
        s2 = classify_state(high_stress)["score"]
        assert s1 > s2

    def test_inverts_load(self):
        low_load = {"energy": 50, "clarity": 50, "stress": 50, "confidence": 50, "load": 10}
        high_load = {"energy": 50, "clarity": 50, "stress": 50, "confidence": 50, "load": 90}
        s1 = classify_state(low_load)["score"]
        s2 = classify_state(high_load)["score"]
        assert s1 > s2

    def test_confidence_between_0_5_and_1_0(self):
        c = classify_state(strong_assessment)["confidence"]
        assert 0.5 <= c <= 1.0

    def test_enforces_valid_transitions_via_govern(self):
        result = govern(strong_assessment, strong_business, strong_financial,
                        strong_relational, tactical_decision, "active_failure")
        assert result["transitionWarning"] is not None

    def test_allows_valid_transitions_via_govern(self):
        result = govern(strong_assessment, strong_business, strong_financial,
                        strong_relational, tactical_decision, "stable")
        valid_targets = ["controlled_expansion", "under_tension", "building", "stable"]
        if result["state"]["id"] in valid_targets:
            assert result["transitionWarning"] is None


# ── VERDICT LOGIC (Art. VII) ────────────────────────────────────────

class TestVerdictLogic:
    def test_sim_for_strong_plus_tactical(self):
        r = govern(strong_assessment, strong_business, strong_financial,
                   strong_relational, tactical_decision)
        assert r["verdict"] == "SIM"
        assert r["blocked"] is False
        assert r["readinessPlan"] is None

    def test_nao_agora_for_weak_plus_existential(self):
        r = govern(weak_assessment, weak_business, weak_financial,
                   weak_relational, existential_decision)
        assert r["verdict"] == "NÃO AGORA"
        assert r["blocked"] is True
        assert r["readinessPlan"] is not None

    def test_binary_verdict(self):
        r = govern(medium_assessment, strong_business, strong_financial,
                   strong_relational, strategic_decision)
        assert r["verdict"] in ("SIM", "NÃO AGORA")

    def test_blocks_when_state_severity_ge_5(self):
        tension = {"energy": 50, "clarity": 50, "stress": 50, "confidence": 50, "load": 50}
        r = govern(tension, strong_business, strong_financial,
                   strong_relational, tactical_decision)
        state = classify_state(tension)["state"]
        if state["severity"] >= 5:
            assert r["blocked"] is True

    def test_blocks_weak_regardless_of_transition(self):
        r = govern(weak_assessment, weak_business, weak_financial,
                   weak_relational, tactical_decision, "controlled_expansion")
        assert r["blocked"] is True
        assert r["verdict"] == "NÃO AGORA"


# ── PIPELINE OUTPUT STRUCTURE ───────────────────────────────────────

class TestPipelineOutputStructure:
    @pytest.fixture(scope="class")
    def result(self):
        return govern(strong_assessment, strong_business, strong_financial,
                      strong_relational, tactical_decision)

    def test_pipeline_metadata(self, result):
        assert result["pipelineId"]
        assert result["timestamp"]
        assert result["constitutionVersion"] == "0.4.0"

    def test_state_info(self, result):
        assert result["state"] is not None
        assert result["state"]["id"]
        assert result["state"]["label"]
        assert result["stateConfidence"] > 0

    def test_all_4_layers(self, result):
        assert result["layers"]["human"]
        assert result["layers"]["business"]
        assert result["layers"]["financial"]
        assert result["layers"]["relational"]

    def test_all_6_domain_scores(self, result):
        for d in ("financial", "emotional", "decisional", "operational", "relational", "energetic"):
            assert d in result["domainScores"]
            assert 0 <= result["domainScores"][d] <= 100

    def test_exactly_4_scenarios(self, result):
        assert len(result["scenarios"]) == 4
        names = [s["id"] for s in result["scenarios"]]
        for n in ("optimistic", "realistic", "stress", "hfailure"):
            assert n in names

    def test_each_scenario_13_month_projection(self, result):
        for s in result["scenarios"]:
            assert len(s["cashProjection"]) == 13
            assert s["cashProjection"][0]["month"] == 0
            assert s["cashProjection"][12]["month"] == 12

    def test_domain_details_with_alert_levels(self, result):
        assert len(result["domainDetails"]) == 6
        for d in result["domainDetails"]:
            assert d["alertLevel"] in ("ok", "preventive", "attention", "critical")

    def test_decision_type_config(self, result):
        assert result["decisionType"]["id"] == "tactical"
        assert result["decisionType"]["minRequired"] > 0

    def test_overall_score_range(self, result):
        assert 0 <= result["overallScore"] <= 100

    def test_gap_non_negative(self, result):
        assert result["gap"] >= 0


# ── THRESHOLDS & VIOLATIONS (Art. III) ──────────────────────────────

class TestThresholdsAndViolations:
    def test_flag_critical_for_scores_below_25(self):
        r = govern(weak_assessment, weak_business, weak_financial,
                   weak_relational, existential_decision)
        criticals = [v for v in r["violations"] if v["level"] == "critical"]
        assert len(criticals) > 0

    def test_no_violations_when_strong_and_tactical(self):
        r = govern(strong_assessment, strong_business, strong_financial,
                   strong_relational, tactical_decision)
        for v in r["violations"]:
            assert v["score"] < v["required"]

    def test_existential_requires_higher_scores_than_tactical(self):
        e = next(t for t in DECISION_TYPES if t["id"] == "existential")
        t = next(t for t in DECISION_TYPES if t["id"] == "tactical")
        assert e["minOverall"] > t["minOverall"]
        assert e["minDomain"] > t["minDomain"]

    def test_thresholds_ranges(self):
        assert THRESHOLDS["critical"] == [0, 24]
        assert THRESHOLDS["attention"] == [25, 39]
        assert THRESHOLDS["preventive"] == [40, 55]


# ── READINESS PLAN (Art. VI) ────────────────────────────────────────

class TestReadinessPlan:
    def test_generates_when_blocked(self):
        r = govern(weak_assessment, weak_business, weak_financial,
                   weak_relational, existential_decision)
        assert r["readinessPlan"] is not None
        plan = r["readinessPlan"]
        assert plan["structuralReason"]
        assert plan["primaryBottleneck"] is not None
        assert len(plan["actions"]) >= 3
        assert len(plan["reevaluationTriggers"]) > 0
        assert plan["timeline"]

    def test_does_not_generate_when_approved(self):
        r = govern(strong_assessment, strong_business, strong_financial,
                   strong_relational, tactical_decision)
        if r["verdict"] == "SIM":
            assert r["readinessPlan"] is None

    def test_primary_bottleneck_is_weakest_domain(self):
        r = govern(weak_assessment, weak_business, weak_financial,
                   weak_relational, existential_decision)
        plan = r["readinessPlan"]
        min_score = min(r["domainScores"].values())
        assert plan["primaryBottleneck"]["score"] == min_score

    def test_actionable_horizon_in_each_action(self):
        r = govern(weak_assessment, weak_business, weak_financial,
                   weak_relational, existential_decision)
        for action in r["readinessPlan"]["actions"]:
            assert action["horizon"]
            assert action["indicator"]
            assert action["action"]


# ── SCENARIO ORDERING ───────────────────────────────────────────────

class TestScenarioLogic:
    def test_optimistic_has_lowest_risk(self):
        r = govern(medium_assessment, strong_business, strong_financial,
                   strong_relational, strategic_decision)
        opt = next(s for s in r["scenarios"] if s["id"] == "optimistic")
        stress = next(s for s in r["scenarios"] if s["id"] == "stress")
        assert opt["systemicRisk"] <= stress["systemicRisk"]

    def test_hfailure_has_highest_load(self):
        r = govern(medium_assessment, strong_business, strong_financial,
                   strong_relational, strategic_decision)
        hfail = next(s for s in r["scenarios"] if s["id"] == "hfailure")
        opt = next(s for s in r["scenarios"] if s["id"] == "optimistic")
        assert hfail["leaderLoad"] >= opt["leaderLoad"]

    def test_stress_cash_lower_than_optimistic_at_m12(self):
        r = govern(medium_assessment, strong_business, strong_financial,
                   strong_relational, strategic_decision)
        opt = next(s for s in r["scenarios"] if s["id"] == "optimistic")
        stress = next(s for s in r["scenarios"] if s["id"] == "stress")
        assert stress["cashProjection"][12]["cash"] <= opt["cashProjection"][12]["cash"]


# ── EDGE CASES ──────────────────────────────────────────────────────

class TestEdgeCases:
    def test_zero_revenue_graceful(self):
        biz = {**strong_business, "revenue": 0}
        fin = {**strong_financial, "revenue": 0}
        govern(strong_assessment, biz, fin, strong_relational, tactical_decision)  # no raise

    def test_zero_cash_graceful(self):
        fin = {**strong_financial, "cash": 0}
        govern(strong_assessment, strong_business, fin, strong_relational, tactical_decision)

    def test_max_conflicts_graceful(self):
        rel = {"activeConflicts": 10, "criticalDependencies": 10,
               "partnerAlignment": 0, "teamStability": 0, "ecosystemHealth": 0}
        govern(strong_assessment, strong_business, strong_financial, rel, tactical_decision)

    def test_all_zero_assessment(self):
        zero = {"energy": 0, "clarity": 0, "stress": 0, "confidence": 0, "load": 0}
        cls = classify_state(zero)
        assert cls["score"] >= 0
        assert cls["state"] is not None

    def test_all_100_assessment(self):
        mx = {"energy": 100, "clarity": 100, "stress": 100, "confidence": 100, "load": 100}
        cls = classify_state(mx)
        assert cls["score"] <= 100
        assert cls["state"] is not None

    def test_unique_pipeline_ids(self):
        r1 = govern(strong_assessment, strong_business, strong_financial,
                    strong_relational, tactical_decision)
        r2 = govern(strong_assessment, strong_business, strong_financial,
                    strong_relational, tactical_decision)
        assert r1["pipelineId"] != r2["pipelineId"]


# ── DECISION TYPE ESCALATION ────────────────────────────────────────

class TestDecisionTypeEscalation:
    def test_existential_harder_than_tactical(self):
        tac = govern(medium_assessment, strong_business, strong_financial,
                     strong_relational, tactical_decision)
        exi = govern(medium_assessment, strong_business, strong_financial,
                     strong_relational, existential_decision)
        if tac["verdict"] == "SIM":
            assert exi["gap"] >= tac["gap"]

    def test_progressive_min_overall(self):
        ordered = sorted(DECISION_TYPES, key=lambda d: d["minOverall"])
        tac, strat, struc, exi = ordered
        assert tac["minOverall"] < strat["minOverall"]
        assert strat["minOverall"] < struc["minOverall"]
        assert struc["minOverall"] < exi["minOverall"]


# ── FINANCIAL LAYER SPECIFICS ───────────────────────────────────────

class TestFinancialLayer:
    def test_runway_calculation(self):
        r = govern(strong_assessment, strong_business, strong_financial,
                   strong_relational, tactical_decision)
        # cash=200000 / fixedCosts=15000 ≈ 13.3 months
        assert round(r["layers"]["financial"]["runway"]) == 13

    def test_penalizes_high_leverage(self):
        low_debt = {**strong_financial, "debt": 0}
        high_debt = {**strong_financial, "debt": 500000}
        r1 = govern(strong_assessment, strong_business, low_debt,
                    strong_relational, tactical_decision)
        r2 = govern(strong_assessment, strong_business, high_debt,
                    strong_relational, tactical_decision)
        assert r1["layers"]["financial"]["score"] > r2["layers"]["financial"]["score"]
