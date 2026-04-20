-- Wave 1 DDL — OS 001 gap closure (VPS+Postgres+Grok replan)
-- Adds: user_assessments, telegram_users, whatsapp_users
-- UNIQUE on user_memory(user_id, category, key) already exists (verified 2026-04-20)
-- Convention: user_id → profiles(id) ON DELETE CASCADE (matches chat_messages/decisions/etc)

BEGIN;

CREATE TABLE IF NOT EXISTS user_assessments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    energy      NUMERIC(5,2) NOT NULL CHECK (energy     BETWEEN 0 AND 100),
    clarity     NUMERIC(5,2) NOT NULL CHECK (clarity    BETWEEN 0 AND 100),
    stress      NUMERIC(5,2) NOT NULL CHECK (stress     BETWEEN 0 AND 100),
    confidence  NUMERIC(5,2) NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    load        NUMERIC(5,2) NOT NULL CHECK (load       BETWEEN 0 AND 100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_assessments_user_created
    ON user_assessments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_users (
    chat_id     BIGINT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    linked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_users_user
    ON telegram_users (user_id);

CREATE TABLE IF NOT EXISTS whatsapp_users (
    phone       TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    linked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_user
    ON whatsapp_users (user_id);

COMMIT;
