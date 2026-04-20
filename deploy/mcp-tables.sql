-- ============================================
-- MCP / Public API Tables
-- ============================================
-- Tables for the public governance API consumed by:
--   • MCP server (Claude Desktop, Claude.ai, ChatGPT Connectors, Cursor, Zed, etc.)
--   • External integrations via Bearer API keys (prefix: lo_sk_)
--
-- Apply with:
--   psql "$DATABASE_URL" -f deploy/mcp-tables.sql
-- ============================================

-- ─── API Keys ───────────────────────────────────────────────
-- One row per issued key. hashed_key stores a bcrypt hash of the
-- full secret (lo_sk_xxx); the raw key is only shown once at creation.

CREATE TABLE IF NOT EXISTS public.public_api_keys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  key_prefix     text NOT NULL,                  -- "lo_sk_abc12345" (public, first 14 chars for lookup)
  hashed_key     text NOT NULL,                  -- bcrypt hash of the full secret
  scopes         text[] NOT NULL DEFAULT ARRAY['evaluate', 'read'],
  rate_limit_per_min  int NOT NULL DEFAULT 30,
  rate_limit_per_day  int NOT NULL DEFAULT 1000,
  last_used_at   timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_api_keys_user       ON public.public_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_public_api_keys_prefix     ON public.public_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_public_api_keys_active     ON public.public_api_keys(revoked_at) WHERE revoked_at IS NULL;


-- ─── API Call Audit Log ─────────────────────────────────────
-- Source of truth for rate limiting + usage analytics. One row per
-- public endpoint request (authorized or not). Keep for 90 days, then
-- truncate.

CREATE TABLE IF NOT EXISTS public.public_api_calls (
  id             bigserial PRIMARY KEY,
  api_key_id     uuid REFERENCES public.public_api_keys(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  endpoint       text NOT NULL,                  -- e.g., "evaluate", "get_verdict"
  status_code    int NOT NULL,
  client         text,                           -- "claude_desktop", "chatgpt", "cursor", raw user-agent fallback
  latency_ms     int,
  request_bytes  int,
  response_bytes int,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_api_calls_key_time  ON public.public_api_calls(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_api_calls_user_time ON public.public_api_calls(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_api_calls_time      ON public.public_api_calls(created_at DESC);

-- Rate limit helper view: requests in the last 60 seconds per key
CREATE OR REPLACE VIEW public.v_public_api_rate_last_min AS
SELECT
  api_key_id,
  count(*) AS requests_last_min
FROM public.public_api_calls
WHERE created_at > now() - interval '1 minute'
GROUP BY api_key_id;

CREATE OR REPLACE VIEW public.v_public_api_rate_last_day AS
SELECT
  api_key_id,
  count(*) AS requests_last_day
FROM public.public_api_calls
WHERE created_at > now() - interval '1 day'
GROUP BY api_key_id;
