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

# Internal base URL — the MCP server makes loopback calls to our own API.
# Override with LIFEOS_API_URL env var for dev/testing.
LIFEOS_API_URL = os.getenv("LIFEOS_API_URL", "http://127.0.0.1:8010")

lifeos_mcp = FastMCP(
    "LifeOS",
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
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
    """Run the LifeOS governance engine on a proposed decision.

    Returns a deterministic verdict (SIM or NÃO AGORA) backed by the Constituição
    Luz & Vaso (Arts. I–VII). The engine evaluates 4 layers (human, business,
    financial, relational), computes 6 domain scores, simulates 4 scenarios,
    and — when blocked — emits a readiness plan with concrete actions.

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

    Returns: the full governance result including verdict, overallScore, gap,
    blocked flag, 4-layer scores, 6-domain scores, 4 scenarios with 13-month
    cash projections, and readinessPlan (if blocked).
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
    """List the authenticated user's recent governance decisions.

    Args:
      limit: max rows to return (default 20, max 100).
    Returns: list of {id, pipeline_id, description, decision_type, verdict,
    overall_score, state_id, created_at} ordered by most recent first.
    """
    return await _call_api(ctx, "GET", "/api/public/decisions", params={"limit": limit})


@lifeos_mcp.tool()
async def get_memory(ctx: Context, category: Optional[str] = None) -> list:
    """Read the user's accumulated memory facts from the LifeOS knowledge base.

    Args:
      category: optional filter (e.g., 'personal', 'professional', 'financial').
        If omitted, returns all categories ordered alphabetically.
    Returns: list of {category, key, value, source, updated_at}.
    """
    params = {"category": category} if category else None
    return await _call_api(ctx, "GET", "/api/public/memory", params=params)


@lifeos_mcp.tool()
async def get_user_context(ctx: Context) -> dict:
    """Get a compact overview of the authenticated user: profile, latest state
    classification, memory facts count, and total decisions made.

    Use this at the start of a session to load context into the conversation
    without loading the full history.
    """
    return await _call_api(ctx, "GET", "/api/public/context")


# ─── Standalone entrypoint ─────────────────────────────────────────
# Not typically used — the server is mounted into the main FastAPI app.
# Provided for local debugging: `python -m api.mcp.server`

if __name__ == "__main__":
    lifeos_mcp.run(transport="streamable-http")
