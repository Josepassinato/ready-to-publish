"""Pydantic validation on POST /api/decisions (Wave 5).

Regression: prior version took `data: dict` and passed raw values to asyncpg,
so `state_severity="normal"` reached a smallint column and produced 500.
Now it should be 422 with a clear error.
"""
import os
import time

import asyncpg
import httpx
import pytest

API_URL = os.getenv("LIFEOS_API_URL", "http://localhost:8010")
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/lifeos")

pytestmark = pytest.mark.asyncio


def _skip_if_api_down():
    try:
        r = httpx.get(f"{API_URL}/api/health", timeout=2)
        if r.status_code != 200:
            pytest.skip(f"API not healthy at {API_URL}")
    except Exception as e:
        pytest.skip(f"API unreachable at {API_URL}: {e}")


def _register(email: str) -> str:
    r = httpx.post(
        f"{API_URL}/api/auth/register",
        json={"email": email, "password": "validation-pw", "name": "V"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


async def _cleanup(email: str) -> None:
    conn = await asyncpg.connect(DB_URL)
    try:
        await conn.execute("DELETE FROM users WHERE email = $1", email)
    finally:
        await conn.close()


async def test_decision_create_rejects_invalid_payloads():
    _skip_if_api_down()
    email = f"val-{int(time.time() * 1000)}@example.com"
    try:
        token = _register(email)
        H = {"Authorization": f"Bearer {token}"}

        cases = [
            ({"description": "x", "state_severity": "normal"}, "state_severity"),
            ({"description": "x", "overall_score": 250}, "overall_score"),
            ({"description": "x", "human_score": -1}, "human_score"),
            ({"description": "x", "decision_type": "random"}, "decision_type"),
        ]
        for payload, bad_field in cases:
            r = httpx.post(f"{API_URL}/api/decisions", json=payload, headers=H, timeout=10)
            assert r.status_code == 422, f"{bad_field}: expected 422 got {r.status_code}: {r.text}"
            errs = r.json()["detail"]
            assert any(bad_field in (e.get("loc") or []) for e in errs), \
                f"error for {bad_field} missing in {errs}"

        valid = {
            "description": "happy",
            "decision_type": "strategic",
            "overall_score": 80,
            "state_severity": 40,
        }
        r_ok = httpx.post(f"{API_URL}/api/decisions", json=valid, headers=H, timeout=10)
        assert r_ok.status_code == 200, r_ok.text
        assert "id" in r_ok.json() and "pipeline_id" in r_ok.json()

    finally:
        await _cleanup(email)
