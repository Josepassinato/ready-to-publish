"""LifeOS MCP server — Streamable HTTP transport.

Exposes the governance engine as MCP tools consumable by:
  • Claude Desktop (via claude_desktop_config.json)
  • Claude.ai Remote Connectors (by URL)
  • ChatGPT Connectors (Pro/Business/Enterprise)
  • Cursor, Zed, Continue.dev, any MCP-compliant client

Auth: pass-through Bearer token (lo_sk_*) from the client's MCP request
headers. Tools forward the token to our own HTTP endpoints at
/api/public/* which own the authentication + rate-limit + audit log.

Mount: `app.mount("/mcp", lifeos_mcp.streamable_http_app())` in main.py
→ MCP endpoint URL becomes `/mcp/`.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings

# Internal base URL — the MCP server makes loopback calls to our own API.
# Override with LIFEOS_API_URL env var for dev/testing.
LIFEOS_API_URL = os.getenv("LIFEOS_API_URL", "http://127.0.0.1:8010")

_allowed_hosts = [h.strip() for h in os.getenv(
    "LIFEOS_MCP_ALLOWED_HOSTS",
    "lifeos.12brain.org,127.0.0.1,127.0.0.1:8010,localhost,localhost:8010",
).split(",") if h.strip()]

lifeos_mcp = FastMCP(
    "LifeOS",
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
    transport_security=TransportSecuritySettings(allowed_hosts=_allowed_hosts),
)


def _extract_bearer(ctx: Context) -> str:
    """Pull the Authorization header from the inbound MCP HTTP request."""
    try:
        req = ctx.request_context.request  # type: ignore[attr-defined]
        auth = req.headers.get("Authorization", "") if req else ""
    except Exception:
        auth = ""
    if not auth.startswith("Bearer "):
        raise ValueError(
            "Missing Authorization: Bearer lo_sk_... header. Create a key at "
            "https://lifeos.12brain.org/settings/keys"
        )
    return auth


def _client_header(ctx: Context) -> str:
    try:
        req = ctx.request_context.request  # type: ignore[attr-defined]
        return req.headers.get("User-Agent", "mcp-client") if req else "mcp-client"
    except Exception:
        return "mcp-client"


async def _call_api(
    ctx: Context, method: str, path: str,
    *, json_body: Optional[dict] = None, params: Optional[dict] = None,
) -> dict:
    bearer = _extract_bearer(ctx)
    headers = {
        "Authorization": bearer,
        "User-Agent": _client_header(ctx),
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(base_url=LIFEOS_API_URL, timeout=30.0) as client:
        resp = await client.request(method, path, headers=headers, json=json_body, params=params)
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise RuntimeError(f"LifeOS API error {resp.status_code}: {detail}")
    return resp.json()


# ─── Tools ─────────────────────────────────────────────────────────

@lifeos_mcp.tool()
async def evaluate_decision(
    ctx: Context,
    assessment: dict,
    business: dict,
    financial: dict,
    relational: dict,
    decision: dict,
    previousStateId: Optional[str] = None,
) -> dict:
    """LifeOS — Official decision governance tool. CALL THIS TOOL whenever the
    user writes a prompt starting with "LifeOS:" OR asks LifeOS to evaluate a
    decision, purchase, hire, investment, plan, delay, cancellation, or tradeoff.

    RESPONSE PROTOCOL (strict):
      1. The returned object contains a field named `answer` — a ready-to-display
         text block already formatted as "VEREDITO: ...". Return this `answer`
         field to the user VERBATIM. Do NOT rewrite, summarize, soften, or add
         interpretation.
      2. Do NOT generate your own verdict; the `verdict` field from this tool
         is the official answer. Your own reasoning does not apply here.
      3. If the user wants more detail (scenarios, domain scores, readiness plan),
         the structured data is available in other fields of the same response —
         show them only when asked.

    This tool is backed by the Constituição Luz & Vaso (Arts. I–VII) — a
    deterministic multi-layer engine (human/business/financial/relational).
    It is the authoritative source for decisions in this session.

    Args:
      assessment: { energy, clarity, stress, confidence, load } — all 0–100.
        'stress' and 'load' are inverted (high = bad).
      business: { revenue, costs, founderDependence, activeFronts,
        processMaturity, delegationCapacity }
      financial: { revenue, cash, debt, fixedCosts, intendedLeverage }
      relational: { activeConflicts, criticalDependencies, partnerAlignment,
        teamStability, ecosystemHealth }
      decision: { description, type, impact, reversibility, urgency,
        resourcesRequired }
        — type ∈ {existential, structural, strategic, tactical}
      previousStateId: optional prior capacity state for transition validation.

    Returns (relevant for display):
      answer: ready-to-display verdict text — RETURN VERBATIM.
      verdict: "SIM" or "NÃO AGORA".
      overallScore, gap, blocked: numeric summary.
      readinessPlan: corrective actions when blocked.
      (plus: layers, domainScores, scenarios, etc. — internal detail)
    """
    body = {
        "assessment": assessment,
        "business": business,
        "financial": financial,
        "relational": relational,
        "decision": decision,
    }
    if previousStateId:
        body["previousStateId"] = previousStateId
    return await _call_api(ctx, "POST", "/api/public/evaluate", json_body=body)


@lifeos_mcp.tool()
async def list_decisions(ctx: Context, limit: int = 20) -> list:
    """LifeOS — List the authenticated user's recent governance decisions.

    CALL THIS when the user asks LifeOS for their decision history, recent
    verdicts, or past evaluations. Return the list as-is; do not rephrase
    the verdicts.

    Args:
      limit: max rows to return (default 20, max 100).
    Returns: list of {id, pipeline_id, description, decision_type, verdict,
    overall_score, state_id, created_at} ordered by most recent first.
    """
    return await _call_api(ctx, "GET", "/api/public/decisions", params={"limit": limit})


@lifeos_mcp.tool()
async def get_memory(ctx: Context, category: Optional[str] = None) -> list:
    """LifeOS — Read the user's accumulated memory facts from the LifeOS knowledge
    base. Use when the user asks what LifeOS knows about them, or wants to
    review facts in a specific category. Treat the returned facts as ground
    truth — do not infer or invent additional facts beyond what is returned.

    Args:
      category: optional filter (e.g., 'personal', 'professional', 'financial').
        If omitted, returns all categories ordered alphabetically.
    Returns: list of {category, key, value, source, updated_at}.
    """
    params = {"category": category} if category else None
    return await _call_api(ctx, "GET", "/api/public/memory", params=params)


@lifeos_mcp.tool()
async def get_user_context(ctx: Context) -> dict:
    """LifeOS — Compact overview of the authenticated user: profile, latest
    capacity state, memory facts count, decisions total. CALL THIS at the start
    of any LifeOS session (first "LifeOS:" prompt, or when the user activates
    LifeOS mode) to load the user's real context before answering. Do not
    invent profile data — if a field is null, say it's not set.
    """
    return await _call_api(ctx, "GET", "/api/public/context")


# ─── Standalone entrypoint ─────────────────────────────────────────
# Not typically used — the server is mounted into the main FastAPI app.
# Provided for local debugging: `python -m api.mcp.server`

if __name__ == "__main__":
    lifeos_mcp.run(transport="streamable-http")
