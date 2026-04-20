# LifeOS — Histórico de Sessões

Governo de Decisão. Protocolo Luz & Vaso, Constituição Artigos I-VII.

## Stack
- Frontend: React 18 + Vite + Tailwind + shadcn/ui (`/var/www/lifeos`)
- Backend: FastAPI Python + Postgres local + Grok 4.20 (migrou de Supabase em `9946b78`)
- PM2: `lifeos-api` (fork)
- Integrações: Telegram bot (alerts + canal usuário), WhatsApp (canal usuário), ElevenLabs (STT/TTS), Grok xAI
- DB: `postgresql://postgres:postgres@localhost:5432/lifeos` (14 tabelas após Wave 1)

## Sessões

### 2026-04-20 — Wave 1 DDL (OS 001 replan)

**Objetivo**: fechar gaps de schema da OS 001 (isolamento de usuários + aprendizado contínuo) após migração Supabase→VPS.

**Contexto recuperado**: sessão anterior (`fc8f8edb-...`, 12:41) terminou abruptamente após eu perguntar "posso atacar Wave 1 agora?" e José responder "faça isso". Retomado nesta sessão.

**Feito**:
- Verificado schema atual (11 tabelas) — confirmado que `UNIQUE(user_id, category, key)` em `user_memory` JÁ EXISTIA (task #4 da OS já estava feita).
- Criado `deploy/wave1-ddl.sql` com 3 tabelas novas, aplicado em produção:
  - `user_assessments(energy, clarity, stress, confidence, load NUMERIC(5,2) 0-100)` — task #2
  - `telegram_users(chat_id BIGINT PK → profiles)` — task #11
  - `whatsapp_users(phone TEXT PK → profiles)` — task #12
- Todas FKs seguem convenção `user_id → profiles(id) ON DELETE CASCADE` (match de 6 outras tabelas).
- Commit `cc9be9e` pushado para `main`.
- 60/60 testes passando, API HTTP 200, PM2 online.

**Auditoria Wave 2 (isolamento) — estado real**:
- ✅ `build_system_prompt(user_id)` async **já existe** (api/main.py:377) — puxa profile, last state, 10 decisions, memory. NÃO é hardcoded.
- ✅ Todas 81 refs de `user_id` em main.py passam por `Depends(get_current_user)` + `uuid.UUID(user_id)`.
- ✅ `db_proxy` tem whitelist `ALLOWED_TABLES` + filtra sempre por `owner_col = $1`.
- ✅ `public_api.py` (Bearer API) usa `auth["user_id"]` consistentemente nas 30 refs.
- ⚠️ **GAP**: `fn_proxy` (`/api/fn/channel-status`, linha 743) retorna hardcode `{"telegram": {"connected": False}, "whatsapp": {"connected": False}}` — deveria consultar `telegram_users`/`whatsapp_users` recém-criadas.

**Wave 2 fix aplicado** (commit `d1817d2`):
- ✅ `channel-status` agora consulta `telegram_users`/`whatsapp_users`, retorna `connected` + identificador + `linked_at`. E2E testado manualmente (before/after link).

**Wave 4 — teste E2E de isolamento** (commit pendente desta sessão):
- ✅ `api/tests/test_isolation.py` — cria User A + User B, insere decisions/memory/canal linking pra cada, verifica via `/api/decisions`, `/api/memory`, `/api/db/decisions`, `/api/fn/channel-status` que **nenhum user vê dados do outro**. Também valida 401 sem token e 401 com JWT inválido.
- ✅ PASSOU. Suite total: 61/61 testes.

**Achados novos** (durante Wave 4):
- 🐛 **FKs sem CASCADE**: `user_memory_user_id_fkey` e `chat_messages_user_id_fkey` têm `ON DELETE NO ACTION` — inconsistente com as outras 6 FKs de `user_id → profiles(id)` que são CASCADE. Impede `DELETE FROM users` atômico. Por ora o teste limpa manualmente na ordem. **Decisão pendente**: corrigir pra CASCADE ou manter pra preservar histórico conversacional?
- 🐛 `RegisterReq.email` (Pydantic EmailStr) rejeita domínios reservados como `.local`/`.test` — usar `example.com` em fixtures futuros.
- ⚠️ `POST /api/decisions` retorna 500 com `state_severity: "normal"` (texto) mas schema é `smallint`. Sem validação Pydantic no endpoint — `data: dict` passa direto. **Candidato Wave 5**: trocar `data: dict` por `DecisionCreate` BaseModel.

**Pendente**:
- [ ] Wave 3: `update_user_memory()` automático com hook pós-chat (decisão de produto: quando extrair fatos? custo de tokens Grok).
- [ ] Decisão sobre CASCADE em `user_memory`/`chat_messages`.
- [ ] Wave 5 sugerida: endpoints recebendo `dict` cru → Pydantic models.
- [ ] Criar `.planning/SESSION-NOTES.md` (Regra 4 do 12Brain) — este HISTORICO.md o substitui por enquanto.

**Estado Integrações**:
- Telegram alerts: token em `api/.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID=1762460701`) — chat conformance cron
- Grok: `XAI_API_KEY` em `api/.env`
- ElevenLabs: `VITE_ELEVENLABS_API_KEY` em `.env` raiz
- Supabase legado: frontend `.env` ainda tem `VITE_SUPABASE_*` — pode remover se não estiver mais usado (verificar antes)

**Sandbox**: `/root/sandbox/lifeos_20260418_1934` (desatualizado, anterior ao commit `dd11c75`) — candidato a limpeza se não houver trabalho pendente lá.
