# LifeOS MCP Server

Model Context Protocol server that exposes the LifeOS governance engine
(Protocolo Luz & Vaso, Constituição Arts. I–VII) as tools callable from
any MCP-compliant client — ChatGPT, Claude Desktop, Claude.ai, Cursor,
Zed, Continue.dev, and others.

**Endpoint (remote, Streamable HTTP):**
```
https://lifeos.12brain.org/mcp/
```

**Auth:** Bearer API key (`lo_sk_…`) created in the user settings UI or
via `POST /api/public/keys`.

**Transport:** Streamable HTTP (stateless, JSON responses). Works over a
single HTTP connection — no websockets, no stdio subprocess.

---

## Tools

| Tool                | Scope      | Description                                                                       |
|---------------------|------------|-----------------------------------------------------------------------------------|
| `evaluate_decision` | `evaluate` | Run the 8-step pipeline on a proposed decision. Returns SIM / NÃO AGORA + plano. |
| `list_decisions`    | `read`     | List recent decisions for the authenticated user.                                 |
| `get_memory`        | `read`     | Read accumulated memory facts (filter by category optional).                      |
| `get_user_context`  | `read`     | Compact overview: profile + latest state + counts.                                |

---

## 1. Claude Desktop

Claude Desktop reads `claude_desktop_config.json` on boot. Add a `remote`
server entry pointing at the LifeOS MCP URL:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lifeos": {
      "url": "https://lifeos.12brain.org/mcp/",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer lo_sk_YOUR_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Desktop. In a new chat, ask: *"Use LifeOS to evaluate a
tactical decision to buy new software."*

---

## 2. Claude.ai — Remote Connector

1. Open **Settings → Connectors → Add custom connector**.
2. **URL:** `https://lifeos.12brain.org/mcp/`
3. **Auth:** Bearer token
4. **Token:** `lo_sk_YOUR_KEY_HERE`
5. Save and enable the connector in the conversation.

Claude.ai auto-discovers the 4 tools via `tools/list`.

---

## 3. ChatGPT — Custom Connector (Pro / Business / Enterprise)

1. Open **Settings → Connectors → Build your own**.
2. **Schema:** MCP (Streamable HTTP)
3. **Server URL:** `https://lifeos.12brain.org/mcp/`
4. **Authentication:** API Key (Bearer)
5. **API Key:** `lo_sk_YOUR_KEY_HERE`
6. Save; enable the connector in a conversation via the `+ Connectors` menu.

---

## 4. Cursor, Zed, Continue.dev

Each IDE has its own config but follows the same pattern — a `servers`
block with URL + Bearer header. Examples:

### Cursor (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "lifeos": {
      "url": "https://lifeos.12brain.org/mcp/",
      "headers": { "Authorization": "Bearer lo_sk_YOUR_KEY_HERE" }
    }
  }
}
```

### Zed (`~/.config/zed/settings.json` → `context_servers`)
```json
{
  "context_servers": {
    "lifeos": {
      "url": "https://lifeos.12brain.org/mcp/",
      "headers": { "Authorization": "Bearer lo_sk_YOUR_KEY_HERE" }
    }
  }
}
```

---

## Local Smoke Test (curl)

Replace `KEY` with your Bearer token.

### List tools
```bash
curl -s -X POST https://lifeos.12brain.org/mcp/ \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Call evaluate_decision
```bash
curl -s -X POST https://lifeos.12brain.org/mcp/ \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0","id":2,"method":"tools/call",
    "params":{
      "name":"evaluate_decision",
      "arguments":{
        "assessment":  {"energy":80,"clarity":85,"stress":20,"confidence":80,"load":20},
        "business":    {"revenue":50000,"costs":20000,"founderDependence":20,"activeFronts":2,"processMaturity":80,"delegationCapacity":75},
        "financial":   {"revenue":50000,"cash":200000,"debt":10000,"fixedCosts":15000,"intendedLeverage":0},
        "relational":  {"activeConflicts":0,"criticalDependencies":1,"partnerAlignment":85,"teamStability":90,"ecosystemHealth":80},
        "decision":    {"description":"Smoke test","type":"tactical","impact":"low","reversibility":"easy","urgency":"low","resourcesRequired":"minimal"}
      }
    }
  }'
```

Expected: 200 with `result.content[0].text` containing the full verdict JSON.

---

## Provisioning API Keys

Keys are issued via the normal LifeOS JWT-authenticated admin API:

```bash
# Authenticate as a LifeOS user (JWT)
TOKEN=$(curl -s -X POST https://lifeos.12brain.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"..."}' | jq -r .access_token)

# Create a key — the full secret is returned ONCE
curl -s -X POST https://lifeos.12brain.org/api/public/keys \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"claude-desktop","scopes":["evaluate","read"]}'

# List keys (only prefixes — never the full secret)
curl -s https://lifeos.12brain.org/api/public/keys \
  -H "Authorization: Bearer $TOKEN"

# Revoke a key
curl -s -X POST https://lifeos.12brain.org/api/public/keys/$KEY_ID/revoke \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rate Limits

Defaults per key:
- **30 req/min**
- **1,000 req/day**

Exceeded requests return `429 Too Many Requests`. All calls — authorized
or not — are logged in `public_api_calls` for audit and analytics.

---

## Architecture (why these choices)

- **Streamable HTTP over stdio:** works across local desktop clients
  *and* remote web clients (Claude.ai, ChatGPT) behind the same URL.
  No subprocess management, no localhost-only limitation.
- **Bearer API keys over OAuth (MVP):** zero round-trips per request,
  users self-serve from the web UI, revocable. OAuth 2.1 is the planned
  upgrade for multi-tenant app distribution.
- **Pass-through auth:** the MCP server forwards the Bearer token to our
  own `/api/public/*` HTTP endpoints. Auth, rate-limiting, and audit
  logging live in *one place* (`api/public_api.py`) — the MCP layer is
  a thin wrapper. Changes to auth/limits don't require MCP changes.
- **Python engine parity:** the Python port of `governance-engine.ts`
  is byte-identical to the TS engine (verified by the parity test
  suite in `api/tests/test_parity.py`). The frontend UI and the MCP
  tools produce the same verdicts for the same inputs.
