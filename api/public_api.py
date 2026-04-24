"""Public API — Bearer-token endpoints consumed by the MCP server and
external integrations (ChatGPT/Claude/Cursor).

Mounted by main.py. All endpoints under /api/public/*.

Auth model:
  Authorization: Bearer lo_sk_<14>_<secret>
  • key_prefix = "lo_sk_" + first 8 chars of secret (used for O(1) DB lookup)
  • hashed_key = bcrypt(full_secret)
  • Rate limits: per-minute + per-day, enforced via public_api_calls count.

Scopes:
  evaluate   — POST /api/public/evaluate
  read       — GET  /api/public/decisions, /api/public/memory
"""
from __future__ import annotations

import os
import secrets
import time
from typing import Optional

import asyncpg
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from api.governance_engine import govern

router = APIRouter(prefix="/api/public", tags=["public"])

KEY_PREFIX_LEN = 8  # chars after "lo_sk_" used for DB lookup


# ─── Helpers ───────────────────────────────────────────────────────

def _generate_key() -> tuple[str, str, str]:
    """Returns (full_secret, key_prefix, hashed_key)."""
    raw = secrets.token_urlsafe(32).replace("_", "").replace("-", "")[:32]
    full = f"lo_sk_{raw}"
    prefix = full[:6 + KEY_PREFIX_LEN]  # "lo_sk_" + 8 chars
    hashed = bcrypt.hashpw(full.encode(), bcrypt.gensalt()).decode()
    return full, prefix, hashed


def _detect_client(user_agent: str) -> str:
    ua = (user_agent or "").lower()
    if "claude" in ua:
        return "claude_desktop"
    if "chatgpt" in ua or "openai" in ua:
        return "chatgpt"
    if "cursor" in ua:
        return "cursor"
    if "zed" in ua:
        return "zed"
    if "continue" in ua:
        return "continue"
    return ua[:60] or "unknown"


async def _log_call(
    pool: asyncpg.Pool,
    api_key_id: Optional[str],
    user_id: Optional[str],
    endpoint: str,
    status_code: int,
    client: str,
    latency_ms: int,
    request_bytes: int,
    response_bytes: int,
    error: Optional[str] = None,
):
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO public_api_calls
               (api_key_id, user_id, endpoint, status_code, client, latency_ms,
                request_bytes, response_bytes, error)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
            api_key_id, user_id, endpoint, status_code, client, latency_ms,
            request_bytes, response_bytes, error,
        )


async def verify_bearer(request: Request) -> dict:
    """Authenticates a Bearer token against public_api_keys. Returns
    {api_key_id, user_id, scopes, rate_limit_per_min, rate_limit_per_day}.
    Also enforces rate limits before returning.
    """
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")

    token = auth[7:].strip()
    if not token.startswith("lo_sk_") or len(token) < 14:
        raise HTTPException(401, "Malformed API key")

    prefix = token[:6 + KEY_PREFIX_LEN]

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT id, user_id, hashed_key, scopes, rate_limit_per_min, rate_limit_per_day, revoked_at
               FROM public_api_keys WHERE key_prefix = $1""",
            prefix,
        )

    if not row or row["revoked_at"] is not None:
        raise HTTPException(401, "Invalid or revoked API key")
    if not bcrypt.checkpw(token.encode(), row["hashed_key"].encode()):
        raise HTTPException(401, "Invalid API key")

    # Rate limits — read current window counts
    async with pool.acquire() as conn:
        rpm = await conn.fetchval(
            "SELECT count(*) FROM public_api_calls WHERE api_key_id = $1 AND created_at > now() - interval '1 minute'",
            row["id"],
        )
        rpd = await conn.fetchval(
            "SELECT count(*) FROM public_api_calls WHERE api_key_id = $1 AND created_at > now() - interval '1 day'",
            row["id"],
        )

    if rpm >= row["rate_limit_per_min"]:
        raise HTTPException(429, f"Rate limit exceeded: {rpm} req/min (max {row['rate_limit_per_min']})")
    if rpd >= row["rate_limit_per_day"]:
        raise HTTPException(429, f"Daily rate limit exceeded: {rpd} req/day (max {row['rate_limit_per_day']})")

    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE public_api_keys SET last_used_at = now() WHERE id = $1", row["id"]
        )

    return {
        "api_key_id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "scopes": list(row["scopes"]),
    }


def _require_scope(auth: dict, scope: str):
    if scope not in auth["scopes"]:
        raise HTTPException(403, f"Missing scope: {scope}")


def format_answer_text(result: dict) -> str:
    """Build a ready-to-display verdict block for downstream LLMs to return verbatim.

    Consumed by MCP clients (ChatGPT Custom Connector, Claude Desktop, etc) that
    might otherwise reinterpret the structured verdict. The tool description
    instructs the model to surface this string as-is.
    """
    verdict = result.get("verdict", "—")
    overall = result.get("overallScore", 0)
    gap = result.get("gap", 0)
    blocked = result.get("blocked", False)
    decision_type = (result.get("decisionType") or {}).get("label", "decisão")
    min_required = (result.get("decisionType") or {}).get("minRequired", 0)
    state = (result.get("state") or {}).get("label", "—")

    lines: list[str] = [
        f"VEREDITO: {verdict}",
        "",
        f"Tipo de decisão: {decision_type}",
        f"Estado atual de capacidade: {state}",
        f"Score geral: {overall}% (mínimo exigido: {min_required}%)",
    ]

    if blocked:
        plan = result.get("readinessPlan") or {}
        reason = plan.get("structuralReason") or (
            f"Gap estrutural de {gap}%: capacidade insuficiente para este tipo de decisão agora."
        )
        lines.extend(["", "Motivo:", reason])

        actions = plan.get("actions") or []
        if actions:
            lines.extend(["", "Próximas ações:"])
            for a in actions[:3]:
                act = a.get("action", "").strip()
                horizon = a.get("horizon", "").strip()
                if act:
                    lines.append(f"• {act}" + (f" ({horizon})" if horizon else ""))

        timeline = plan.get("timeline")
        if timeline:
            lines.extend(["", f"Reavaliar em: {timeline}"])
    else:
        lines.extend([
            "",
            "O sistema identificou capacidade estrutural suficiente para executar esta decisão agora.",
            "Prossiga mantendo observação dos indicadores de estado.",
        ])

    lines.extend([
        "",
        "— Veredito oficial do LifeOS (Constituição Luz & Vaso). Não reinterpretar.",
    ])
    return "\n".join(lines)


# ─── Schemas ───────────────────────────────────────────────────────

class AssessmentIn(BaseModel):
    energy: float
    clarity: float
    stress: float
    confidence: float
    load: float


class BusinessIn(BaseModel):
    revenue: float
    costs: float
    founderDependence: float
    activeFronts: float
    processMaturity: float
    delegationCapacity: float


class FinancialIn(BaseModel):
    revenue: float
    cash: float
    debt: float
    fixedCosts: float
    intendedLeverage: float


class RelationalIn(BaseModel):
    activeConflicts: float
    criticalDependencies: float
    partnerAlignment: float
    teamStability: float
    ecosystemHealth: float


class DecisionIn(BaseModel):
    description: str
    type: str  # "existential" | "structural" | "strategic" | "tactical"
    impact: str
    reversibility: str
    urgency: str
    resourcesRequired: str


class EvaluateReq(BaseModel):
    assessment: AssessmentIn
    business: BusinessIn
    financial: FinancialIn
    relational: RelationalIn
    decision: DecisionIn
    previousStateId: Optional[str] = None


# ─── Endpoints ─────────────────────────────────────────────────────

@router.post("/evaluate")
async def evaluate(data: EvaluateReq, request: Request, auth: dict = Depends(verify_bearer)):
    _require_scope(auth, "evaluate")
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]
    started = time.perf_counter()
    client = _detect_client(request.headers.get("User-Agent", ""))
    req_bytes = int(request.headers.get("content-length", 0) or 0)
    err: Optional[str] = None
    status = 200
    try:
        result = govern(
            data.assessment.model_dump(),
            data.business.model_dump(),
            data.financial.model_dump(),
            data.relational.model_dump(),
            data.decision.model_dump(),
            data.previousStateId,  # type: ignore[arg-type]
        )
        result["answer"] = format_answer_text(result)
        return result
    except Exception as e:
        status = 500
        err = f"{e.__class__.__name__}: {e}"[:200]
        raise
    finally:
        latency_ms = int((time.perf_counter() - started) * 1000)
        await _log_call(
            pool, auth["api_key_id"], auth["user_id"], "evaluate",
            status, client, latency_ms, req_bytes, 0, err,
        )


@router.get("/decisions")
async def list_decisions(request: Request, auth: dict = Depends(verify_bearer), limit: int = 20):
    _require_scope(auth, "read")
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]
    started = time.perf_counter()
    client = _detect_client(request.headers.get("User-Agent", ""))
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, pipeline_id, description, decision_type, verdict, overall_score,
                          state_id, created_at
                   FROM decisions WHERE user_id = $1
                   ORDER BY created_at DESC LIMIT $2""",
                auth["user_id"], min(limit, 100),
            )
        return [
            {
                "id": str(r["id"]),
                "pipeline_id": r["pipeline_id"],
                "description": r["description"],
                "decision_type": r["decision_type"],
                "verdict": r["verdict"],
                "overall_score": r["overall_score"],
                "state_id": r["state_id"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
    finally:
        latency_ms = int((time.perf_counter() - started) * 1000)
        await _log_call(
            pool, auth["api_key_id"], auth["user_id"], "list_decisions",
            200, client, latency_ms, 0, 0,
        )


@router.get("/memory")
async def get_memory(request: Request, auth: dict = Depends(verify_bearer), category: Optional[str] = None):
    _require_scope(auth, "read")
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]
    started = time.perf_counter()
    client = _detect_client(request.headers.get("User-Agent", ""))
    try:
        async with pool.acquire() as conn:
            if category:
                rows = await conn.fetch(
                    "SELECT category, key, value, source, updated_at FROM user_memory "
                    "WHERE user_id = $1 AND category = $2 ORDER BY key",
                    auth["user_id"], category,
                )
            else:
                rows = await conn.fetch(
                    "SELECT category, key, value, source, updated_at FROM user_memory "
                    "WHERE user_id = $1 ORDER BY category, key",
                    auth["user_id"],
                )
        return [
            {
                "category": r["category"],
                "key": r["key"],
                "value": r["value"],
                "source": r["source"],
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
            }
            for r in rows
        ]
    finally:
        latency_ms = int((time.perf_counter() - started) * 1000)
        await _log_call(
            pool, auth["api_key_id"], auth["user_id"], "get_memory",
            200, client, latency_ms, 0, 0,
        )


@router.get("/context")
async def get_user_context(request: Request, auth: dict = Depends(verify_bearer)):
    _require_scope(auth, "read")
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]
    started = time.perf_counter()
    client = _detect_client(request.headers.get("User-Agent", ""))
    try:
        async with pool.acquire() as conn:
            profile = await conn.fetchrow(
                "SELECT name, company, role, sector, size FROM profiles WHERE id = $1",
                auth["user_id"],
            )
            latest_state = await conn.fetchrow(
                """SELECT state_id, state_label, overall_score, created_at
                   FROM state_classifications WHERE user_id = $1
                   ORDER BY created_at DESC LIMIT 1""",
                auth["user_id"],
            )
            memory_count = await conn.fetchval(
                "SELECT count(*) FROM user_memory WHERE user_id = $1", auth["user_id"]
            )
            decision_count = await conn.fetchval(
                "SELECT count(*) FROM decisions WHERE user_id = $1", auth["user_id"]
            )
        return {
            "profile": dict(profile) if profile else None,
            "latestState": (
                {
                    "id": latest_state["state_id"],
                    "label": latest_state["state_label"],
                    "score": latest_state["overall_score"],
                    "createdAt": latest_state["created_at"].isoformat() if latest_state["created_at"] else None,
                }
                if latest_state else None
            ),
            "memoryFacts": memory_count or 0,
            "totalDecisions": decision_count or 0,
        }
    finally:
        latency_ms = int((time.perf_counter() - started) * 1000)
        await _log_call(
            pool, auth["api_key_id"], auth["user_id"], "get_context",
            200, client, latency_ms, 0, 0,
        )


# ─── Admin endpoints (JWT-authed, mounted by main.py) ──────────────
# These are *not* Bearer-authed; they use the normal user JWT so a user
# can self-serve keys from the web UI.

admin_router = APIRouter(prefix="/api/public/keys", tags=["public-admin"])


class CreateKeyReq(BaseModel):
    name: str
    scopes: Optional[list[str]] = None  # defaults to ['evaluate', 'read']


@admin_router.post("")
async def create_api_key(data: CreateKeyReq, request: Request):
    """Create a new API key. The full secret is returned ONCE — never stored.
    Auth: standard user JWT (imported in main.py via Depends(get_current_user))."""
    from api.main import get_current_user  # local import to avoid circular
    user_id = await get_current_user(request)
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]

    full, prefix, hashed = _generate_key()
    scopes = data.scopes or ["evaluate", "read"]

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO public_api_keys (user_id, name, key_prefix, hashed_key, scopes)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, created_at""",
            user_id, data.name, prefix, hashed, scopes,
        )
    return {
        "id": str(row["id"]),
        "name": data.name,
        "api_key": full,          # shown once
        "prefix": prefix,
        "scopes": scopes,
        "created_at": row["created_at"].isoformat(),
    }


@admin_router.get("")
async def list_api_keys(request: Request):
    from api.main import get_current_user
    user_id = await get_current_user(request)
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, name, key_prefix, scopes, rate_limit_per_min, rate_limit_per_day,
                      last_used_at, revoked_at, created_at
               FROM public_api_keys WHERE user_id = $1 ORDER BY created_at DESC""",
            user_id,
        )
    return [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "prefix": r["key_prefix"],
            "scopes": list(r["scopes"]),
            "rate_limit_per_min": r["rate_limit_per_min"],
            "rate_limit_per_day": r["rate_limit_per_day"],
            "last_used_at": r["last_used_at"].isoformat() if r["last_used_at"] else None,
            "revoked_at": r["revoked_at"].isoformat() if r["revoked_at"] else None,
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@admin_router.post("/{key_id}/revoke")
async def revoke_api_key(key_id: str, request: Request):
    from api.main import get_current_user
    user_id = await get_current_user(request)
    pool: asyncpg.Pool = request.app.state.pool  # type: ignore[attr-defined]
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE public_api_keys SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
            key_id, user_id,
        )
    if result.endswith("0"):
        raise HTTPException(404, "Key not found or already revoked")
    return {"status": "revoked"}
