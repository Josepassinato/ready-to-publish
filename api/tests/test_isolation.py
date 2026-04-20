"""E2E isolation: verify User A cannot see User B's data across all endpoints.

Wave 4 of OS 001. Runs against live API at API_URL (default localhost:8010).
Skipped if API or DB unreachable.
"""
import os
import time
import uuid
from typing import Any

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


def _register(email: str, name: str) -> tuple[str, str]:
    r = httpx.post(
        f"{API_URL}/api/auth/register",
        json={"email": email, "password": "isolation-test-pw", "name": name},
        timeout=10,
    )
    r.raise_for_status()
    token = r.json()["access_token"]
    uid = httpx.get(f"{API_URL}/api/auth/me", headers=_auth(token), timeout=5).json()["id"]
    return token, str(uid)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_decision(token: str, description: str) -> dict:
    payload = {
        "description": description,
        "decision_type": "strategic",
        "impact": "medium",
        "reversibility": "reversible",
        "urgency": "normal",
        "resources_required": "low",
        "verdict": "APPROVED",
        "overall_score": 75,
        "blocked": False,
        "state_id": "CAPAZ",
        "state_severity": 50,
        "human_score": 70,
        "business_score": 80,
        "financial_score": 75,
        "relational_score": 70,
        "domain_financial": 75,
        "domain_emotional": 70,
        "domain_decisional": 80,
        "domain_operational": 75,
        "domain_relational": 70,
        "domain_energetic": 75,
        "full_result": {},
        "guidance_text": "test",
    }
    r = httpx.post(f"{API_URL}/api/decisions", json=payload, headers=_auth(token), timeout=10)
    r.raise_for_status()
    return r.json()


def _upsert_memory(token: str, category: str, key: str, value: str) -> Any:
    r = httpx.post(
        f"{API_URL}/api/db/user_memory",
        json={"category": category, "key": key, "value": value},
        headers=_auth(token),
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


async def _cleanup_users(*emails: str) -> None:
    """Delete test users. Manually clears user_memory/chat_messages first
    because those FKs are NO ACTION (not CASCADE) — see HISTORICO.md."""
    conn = await asyncpg.connect(DB_URL)
    try:
        ids = await conn.fetch("SELECT id FROM users WHERE email = ANY($1)", list(emails))
        id_list = [r["id"] for r in ids]
        if id_list:
            await conn.execute("DELETE FROM user_memory WHERE user_id = ANY($1)", id_list)
            await conn.execute("DELETE FROM chat_messages WHERE user_id = ANY($1)", id_list)
            await conn.execute("DELETE FROM users WHERE id = ANY($1)", id_list)
    finally:
        await conn.close()


async def _link_telegram(user_id: str, chat_id: int) -> None:
    conn = await asyncpg.connect(DB_URL)
    try:
        await conn.execute(
            "INSERT INTO telegram_users (chat_id, user_id) VALUES ($1, $2)",
            chat_id, uuid.UUID(user_id),
        )
    finally:
        await conn.close()


async def _link_whatsapp(user_id: str, phone: str) -> None:
    conn = await asyncpg.connect(DB_URL)
    try:
        await conn.execute(
            "INSERT INTO whatsapp_users (phone, user_id) VALUES ($1, $2)",
            phone, uuid.UUID(user_id),
        )
    finally:
        await conn.close()


async def test_user_isolation_across_all_endpoints():
    _skip_if_api_down()

    stamp = int(time.time() * 1000)
    email_a = f"iso-a-{stamp}@example.com"
    email_b = f"iso-b-{stamp}@example.com"

    try:
        token_a, uid_a = _register(email_a, "User A")
        token_b, uid_b = _register(email_b, "User B")
        assert uid_a != uid_b

        dec_a = _create_decision(token_a, "A: launch product X")
        dec_b = _create_decision(token_b, "B: hire consultant")
        mem_a = _upsert_memory(token_a, "professional", "role", "CEO-A")
        mem_b = _upsert_memory(token_b, "professional", "role", "CTO-B")

        chat_id_a = 100_000_000 + stamp % 1_000_000
        phone_b = f"+5511{stamp % 10_000_000:07d}"
        await _link_telegram(uid_a, chat_id_a)
        await _link_whatsapp(uid_b, phone_b)

        # --- /api/decisions ---
        decs_a = httpx.get(f"{API_URL}/api/decisions", headers=_auth(token_a)).json()
        decs_b = httpx.get(f"{API_URL}/api/decisions", headers=_auth(token_b)).json()
        ids_a = {d["id"] for d in decs_a}
        ids_b = {d["id"] for d in decs_b}
        assert dec_a["id"] in ids_a and dec_b["id"] not in ids_a, "A sees B's decision"
        assert dec_b["id"] in ids_b and dec_a["id"] not in ids_b, "B sees A's decision"

        # --- /api/memory ---
        mems_a = httpx.get(f"{API_URL}/api/memory", headers=_auth(token_a)).json()
        mems_b = httpx.get(f"{API_URL}/api/memory", headers=_auth(token_b)).json()
        keys_a = {(m["category"], m["key"], m["value"]) for m in mems_a}
        keys_b = {(m["category"], m["key"], m["value"]) for m in mems_b}
        assert ("professional", "role", "CEO-A") in keys_a
        assert ("professional", "role", "CTO-B") not in keys_a, "A sees B's memory"
        assert ("professional", "role", "CTO-B") in keys_b
        assert ("professional", "role", "CEO-A") not in keys_b, "B sees A's memory"

        # --- db_proxy GET decisions ---
        proxy_a = httpx.get(f"{API_URL}/api/db/decisions", headers=_auth(token_a)).json()
        assert all(d["user_id"] == uid_a for d in proxy_a), "db_proxy leaked foreign rows to A"

        # --- /api/fn/channel-status ---
        cs_a = httpx.post(f"{API_URL}/api/fn/channel-status", headers=_auth(token_a)).json()
        cs_b = httpx.post(f"{API_URL}/api/fn/channel-status", headers=_auth(token_b)).json()
        assert cs_a["telegram"]["connected"] is True
        assert cs_a["telegram"]["chat_id"] == chat_id_a
        assert cs_a["whatsapp"]["connected"] is False, "A sees B's whatsapp link"
        assert cs_b["whatsapp"]["connected"] is True
        assert cs_b["whatsapp"]["phone"] == phone_b
        assert cs_b["telegram"]["connected"] is False, "B sees A's telegram link"

        # --- no token → 401 ---
        unauth = httpx.get(f"{API_URL}/api/decisions")
        assert unauth.status_code == 401

        # --- wrong token / forged sub is rejected by JWT signature ---
        bad = httpx.get(f"{API_URL}/api/decisions", headers={"Authorization": "Bearer forged.token.value"})
        assert bad.status_code == 401

    finally:
        await _cleanup_users(email_a, email_b)
