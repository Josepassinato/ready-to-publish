"""Tests for format_answer_text — the verbatim verdict block injected into
/api/public/evaluate responses so downstream LLMs (ChatGPT Custom Connector,
Claude Desktop) surface the official verdict without reinterpretation.
"""
from public_api import format_answer_text


def test_blocked_decision_formats_full_readiness_plan():
    result = {
        "verdict": "NÃO AGORA",
        "overallScore": 42,
        "gap": 28,
        "blocked": True,
        "decisionType": {"label": "estrutural", "minRequired": 70},
        "state": {"label": "Restrito"},
        "readinessPlan": {
            "structuralReason": "Capacidade financeira abaixo do mínimo.",
            "actions": [
                {"action": "Reduzir custos fixos", "horizon": "30 dias"},
                {"action": "Validar demanda", "horizon": "14 dias"},
                {"action": "Revisar contrato", "horizon": "7 dias"},
            ],
            "timeline": "60 dias",
        },
    }
    text = format_answer_text(result)

    assert text.startswith("VEREDITO: NÃO AGORA")
    assert "Tipo de decisão: estrutural" in text
    assert "Estado atual de capacidade: Restrito" in text
    assert "Score geral: 42% (mínimo exigido: 70%)" in text
    assert "Motivo:" in text
    assert "Capacidade financeira abaixo do mínimo." in text
    assert "Próximas ações:" in text
    assert "• Reduzir custos fixos (30 dias)" in text
    assert "• Validar demanda (14 dias)" in text
    assert "• Revisar contrato (7 dias)" in text
    assert "Reavaliar em: 60 dias" in text
    assert text.rstrip().endswith("Não reinterpretar.")


def test_green_decision_skips_readiness_plan():
    result = {
        "verdict": "SIM",
        "overallScore": 82,
        "gap": 0,
        "blocked": False,
        "decisionType": {"label": "tática", "minRequired": 60},
        "state": {"label": "Expansivo"},
    }
    text = format_answer_text(result)

    assert text.startswith("VEREDITO: SIM")
    assert "Score geral: 82% (mínimo exigido: 60%)" in text
    assert "Motivo:" not in text
    assert "Próximas ações:" not in text
    assert "Reavaliar em:" not in text
    assert "capacidade estrutural suficiente" in text
    assert text.rstrip().endswith("Não reinterpretar.")


def test_caps_actions_at_three_even_when_more_provided():
    result = {
        "verdict": "NÃO AGORA",
        "blocked": True,
        "readinessPlan": {
            "actions": [
                {"action": f"Ação {i}", "horizon": "X dias"} for i in range(6)
            ],
        },
    }
    text = format_answer_text(result)
    assert "• Ação 0" in text
    assert "• Ação 1" in text
    assert "• Ação 2" in text
    assert "• Ação 3" not in text


def test_empty_payload_falls_back_to_placeholders_without_crashing():
    text = format_answer_text({})
    assert "VEREDITO: —" in text
    assert text.rstrip().endswith("Não reinterpretar.")
