"""TS vs Python engine parity: runs the same fixtures through the Python port
and asserts byte-identical output against the golden file dumped by TS.

Regenerate golden: `npx vitest run src/test/parity-dump.test.ts` from repo root.
"""
import json
from pathlib import Path

import pytest

from api.governance_engine import govern

FIXTURES = Path(__file__).parent / "parity_fixtures.json"
GOLDEN = Path(__file__).parent / "parity_golden.json"


def _strip(result: dict) -> dict:
    return {k: v for k, v in result.items() if k not in ("pipelineId", "timestamp")}


@pytest.fixture(scope="module")
def fixtures():
    return json.loads(FIXTURES.read_text())


@pytest.fixture(scope="module")
def golden():
    assert GOLDEN.exists(), (
        "parity_golden.json not found. Regenerate with "
        "`npx vitest run src/test/parity-dump.test.ts`"
    )
    return json.loads(GOLDEN.read_text())


@pytest.mark.parametrize(
    "fixture_name",
    ["strong_tactical", "weak_existential", "medium_strategic",
     "edge_zero_revenue", "edge_max_conflicts"],
)
def test_parity(fixtures, golden, fixture_name):
    fixture = next(f for f in fixtures if f["name"] == fixture_name)
    result = govern(
        fixture["assessment"], fixture["business"], fixture["financial"],
        fixture["relational"], fixture["decision"],
    )
    py_out = _strip(result)
    ts_out = golden[fixture_name]

    # Byte-identical comparison via canonical JSON
    py_json = json.dumps(py_out, sort_keys=True, ensure_ascii=False)
    ts_json = json.dumps(ts_out, sort_keys=True, ensure_ascii=False)
    assert py_json == ts_json, (
        f"Parity drift for '{fixture_name}'.\n"
        f"Python: {py_json[:400]}\n"
        f"TS:     {ts_json[:400]}"
    )
