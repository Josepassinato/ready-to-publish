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

**Wave 5 — Pydantic em `POST /api/decisions`**:
- ✅ Criado `DecisionCreate` BaseModel (api/main.py:253) com tipagem forte e `Field(ge=0, le=100)` nos 12 scores (`overall_score`, `state_severity`, `human_score`, `business_score`, `financial_score`, `relational_score`, 6 `domain_*`).
- ✅ `decision_type` agora usa `DecisionTypeLiteral` importado do `governance_engine.py` — Pydantic rejeita valores fora de `existential|structural|strategic|tactical`.
- ✅ Endpoint trocado de `data: dict` → `data: DecisionCreate`; `data.get(k, default)` → `data.k`. Defaults preservados (backward compat).
- ✅ Criado `api/tests/test_decision_validation.py` — 4 casos 422 (`state_severity="normal"`, `overall_score=250`, `human_score=-1`, `decision_type="random"`) + happy path. Suite: **62/62**.
- ✅ Bug original reproduzido → confirmado 422 ao invés de 500 (antes: `state_severity="normal"` vazava até asyncpg → `DataError`).
- API reloadada via `pm2 restart lifeos-api`, online, smoke 401 OK.

**MCP exposição pública (ChatGPT Custom Connector)**:
- Diagnóstico: server MCP (4 tools) construído em `api/mcp/server.py` desde commit `dd11c75`, local `POST /mcp/ tools/list` → 200, mas URL pública `https://lifeos.12brain.org/mcp/` retornava **405** (nginx sem `location /mcp/`) e depois **421 Invalid Host** (FastMCP DNS rebinding protection).
- ✅ Fix 1 — nginx: adicionado `location /mcp/` em `/etc/nginx/sites-enabled/lifeos` com `proxy_buffering off` + `chunked_transfer_encoding on` (compat com Streamable HTTP). Backup antigo movido pra `/root/nginx-backups/` (estava duplicando server_name por estar dentro de `sites-enabled/`).
- ✅ Fix 2 — FastMCP: passado `transport_security=TransportSecuritySettings(allowed_hosts=[...])` com `lifeos.12brain.org` + loopback. Lista configurável via env `LIFEOS_MCP_ALLOWED_HOSTS`.
- ✅ E2E público: `POST https://lifeos.12brain.org/mcp/` `tools/list` → **200** com os 4 tools. `tools/call list_decisions` sem Bearer → erro estruturado MCP (`isError:true`, mensagem orienta criar key) — compatível com doutrina "não retornar erro cru".
- ⚠️ **Gap remanescente**: UI `/settings/keys` ainda não existe. Para ativar no ChatGPT, criar key via `POST /api/public/keys` (curl+JWT).
- ⚠️ **Não validado**: conexão real no ChatGPT Pro Custom Connector + `evaluate_decision` de ponta a ponta.

**Wave B — CASCADE nas FKs faltantes** (commit `151f462`):
- ✅ `deploy/wave-b-cascade.sql`: `user_memory_user_id_fkey` e `chat_messages_user_id_fkey` migradas de `ON DELETE NO ACTION` → `ON DELETE CASCADE`. Aplicado em prod via transação. Agora 9/9 FKs `user_id → profiles(id)` são CASCADE. `DELETE FROM users` volta a ser atômico.
- ✅ 62/62 testes seguem passando.

**Pendente**:
- [ ] Wave 3: `update_user_memory()` automático com hook pós-chat (decisão de produto: quando extrair fatos? custo de tokens Grok).
- [ ] Governance_engine fallback `DECISION_TYPES[2]` (linhas 271, 399, 491) virou código morto com Pydantic Literal no boundary — trocar por `raise` defensivo.
- [ ] UI `/settings/keys` para geração/revogação de `lo_sk_*` sem precisar curl.
- [ ] Refactor Supabase legado no frontend (14 arquivos: 5 pages + 5 lib/hooks + 4 outros) — substituir por chamadas `/api/*` do VPS. Só depois disso remove `VITE_SUPABASE_*` do `.env` raiz.
- [ ] Teste E2E real: configurar ChatGPT Custom Connector e chamar `evaluate_decision`.

**Estado Integrações**:
- Telegram alerts: token em `api/.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID=1762460701`) — chat conformance cron
- Grok: `XAI_API_KEY` em `api/.env`
- ElevenLabs: `VITE_ELEVENLABS_API_KEY` em `.env` raiz
- Supabase legado: frontend `.env` ainda tem `VITE_SUPABASE_*` — pode remover se não estiver mais usado (verificar antes)

**Sandbox**: `/root/sandbox/lifeos_20260418_1934` (desatualizado, anterior ao commit `dd11c75`) — candidato a limpeza se não houver trabalho pendente lá.

### 2026-04-24 — UI `/connect-gpt` + paste no onboarding

**Objetivo**: fechar a lacuna de UX pendente desde 20/04 — usuário precisava de curl para criar
API key `lo_sk_*` e plugar no ChatGPT. Também: adicionar paste direto no passo de import do
onboarding para não exigir salvar arquivo `.json`.

**Feito** (commit pendente ao final desta seção):
- **Nova página** `src/pages/ConnectGPT.tsx` (390 linhas) — lista/gera/revoga keys (GET/POST/revoke
  de `/api/public/keys`), card com URL do MCP, instruções passo-a-passo do ChatGPT Pro, lista das
  4 tools. Modal de exibição única para a chave recém-gerada (nunca vai aparecer de novo).
- **Rota** `/connect-gpt` em `src/App.tsx` (lazy-loaded) + **item de menu** "Conectar GPT" em
  `src/components/AppLayout.tsx`.
- **Onboarding step 4** (`src/pages/Onboarding.tsx`) — trocado o upload único por `<Tabs>`
  "Colar texto" | "Upload .json". Reaproveita o mesmo `extractJsonFromText` + `validateFacts`.
- Backend intocado — endpoints já existiam em `api/public_api.py` desde `dd11c75`.

**Deploy + teste**:
- Sandbox `/root/sandbox/lifeos_20260424_1424`, `npm run build` verde.
- rsync → `/var/www/lifeos/` (excluindo `.env`, `.git`, `.planning`, `HISTORICO.md`,
  `node_modules`, `bun.lockb`). Frontend estático, sem restart PM2.
- Playwright: login → `/connect-gpt` renderiza com key existente "chatgpt" visível e instruções;
  `/onboarding` step 4 com paste tab ativa e textarea funcional.
- Screenshots em `/tmp/lifeos-{02-connect-gpt,04-onboarding-paste-tab}.png`.

**Discussão sem ação** (ficou pra próxima sessão):
- José compartilhou análise do ChatGPT sobre "contaminação" de resposta do LLM quando orquestra
  MCP tools. Alinhamento: Custom Connector MCP não tem system prompt editável → não há como forçar
  verbatim. Caminho estudado: Custom GPT paralelo (Actions OpenAPI com system prompt próprio),
  ou retornar `{verdict_preview, canonical_url}` em `evaluate_decision` e deixar o verdict canônico
  no app/Telegram/WhatsApp. Nada disso foi implementado ainda.

**Key ativa**: 1 — `lo_sk_12fqrXnu…` ("chatgpt"), criada 14:20 UTC.

### 2026-04-24 — Anti-contaminação ChatGPT: `answer` verbatim + tool descs blindadas + `/connect-gpt` dois caminhos

**Objetivo**: fechar os 2 pendentes de curto prazo da sessão anterior sobre contaminação do verdict
pelo ChatGPT quando orquestra MCP tools. Também: reposicionar a UI `/connect-gpt` para comunicar
os dois caminhos de uso (ChatGPT via Connector + chat nativo autoritativo).

**Contexto recuperado**: sessão `d663c7ce` (14:41) caiu após completar as tasks 1-3 de 6.
Esta sessão recuperou o estado do transcript, finalizou as tasks 4-6 (reposicionamento + testes + deploy)
e atualizou SESSION-NOTES duplo (/var/www + sandbox) antes do deploy.

**Feito** (commit `363c85a`):
- **`api/public_api.py`** — nova função `format_answer_text(result)` (~55 linhas) que gera bloco
  pronto-para-exibir a partir do result do governance_engine:
  `"VEREDITO: <SIM|NÃO AGORA>\nTipo de decisão: ...\nEstado atual: ...\nScore geral: N% (mínimo N%)\n
  [Motivo + 3 próximas ações + Reavaliar em]\n— Veredito oficial do LifeOS (Constituição Luz & Vaso).
  Não reinterpretar."`. Injetado em `POST /api/public/evaluate` como campo `answer`. Aditivo, nada
  removido — clientes existentes não quebram.
- **`api/mcp/server.py`** — 4 tool descriptions reescritas como instruções explícitas pro LLM
  cliente (ChatGPT/Claude Desktop):
  - `evaluate_decision`: "CALL THIS TOOL when prompt starts with 'LifeOS:' OR asks to evaluate a
    decision/purchase/hire/investment/plan/delay/cancellation/tradeoff. Return `answer` VERBATIM.
    Do NOT rewrite, summarize, soften, or add interpretation."
  - `list_decisions`: "do not rephrase verdicts"
  - `get_memory`: "treat as ground truth — do not infer"
  - `get_user_context`: "Do not invent profile data — if a field is null, say it's not set"
  - Governance_engine Python intocado (test_parity continua verde, byte-identical vs golden TS).
- **`src/pages/ConnectGPT.tsx`** — reposicionado:
  - Header: "Você tem dois caminhos pra falar com o LifeOS. Escolha o que encaixa no seu fluxo."
  - Grid 2 cards lado a lado: **ChatGPT + LifeOS** (com trigger `LifeOS:` em destaque) vs
    **Chat nativo LifeOS** (Link to=/chat, "canal autoritativo, verdict exato sem intermediário").
  - Passo 3 com nome do Connector sugerido `LifeOS`, instrução explícita do trigger, 3 exemplos
    (`LifeOS: devo contratar um designer por 30 dias?` etc).
  - Disclaimer âmbar "Aviso honesto": ChatGPT pode ocasionalmente reinterpretar; para verdict
    canônico sem intermediário, usar `/chat`.
  - Imports novos: `Link` (react-router-dom), `MessageCircle` + `Info` (lucide-react).
- **`api/tests/test_format_answer.py`** — 4 testes novos cobrindo: blocked com readinessPlan
  (verifica label, score, 3 ações, timeline, fechamento), SIM sem plano, cap de 3 ações quando
  6 são fornecidas, payload `{}` vazio (fallback sem crash).

**Validação**:
- pytest sandbox: **66/66** passando (era 62/62). 4 novos + 62 herdados.
- npm run build sandbox: verde. `ConnectGPT-BqKzZlFo.js` = 16.02 kB (era 12.28 kB). 0 erros TS.
- Smoke programático de `format_answer_text` em 3 cenários — saída bem formatada.
- pytest produção (subset 10 testes): 10/10 — confirma que o transplante via rsync não quebrou imports.

**Deploy** (commit `363c85a` pushado):
- rsync sandbox → `/var/www/lifeos/` com exclusões (.git, .planning, node_modules, .env, bun.lockb, .pytest_cache, dist, HISTORICO.md).
- `dist/` copiado separadamente do sandbox (build já validado) porque produção não tem `vite` global.
- `pm2 restart lifeos-api` — subiu limpo (pid 1562118, restart count 1, startup logs OK).
- **Smoke pós-deploy**:
  - `GET /` → 200
  - `GET /connect-gpt` → 200
  - `GET /api/health` → `{"status":"ok","service":"lifeos-api","ai":"grok-4.20"}`
  - `POST /mcp/ tools/list` → 200 com as 4 tools e as **descriptions NOVAS blindadas** confirmadas
    ("CALL THIS TOOL", "Return `answer` VERBATIM", "Do NOT rewrite...").
  - pm2 logs sem erro (startup.ready db_pool_ok, mcp_session_manager_ok).
  - `grep "dois caminhos\|Aviso honesto" dist/assets/ConnectGPT-*.js` → match no bundle em produção.

**Pendente (validação visual)**:
- Playwright do `/connect-gpt` reposicionado não rodou no sandbox (precisa backend + nginx); José
  valida manualmente abrindo https://lifeos.12brain.org/connect-gpt no browser (deve ver 2 cards
  lado a lado no topo + disclaimer âmbar no passo 3).
- E2E MCP com `tools/call evaluate_decision` via ChatGPT Pro (ou curl com Bearer real) — José testa
  chamando `LifeOS: ...` no próprio ChatGPT e verificando se o verdict sai verbatim.

**Pendências de produto** (pós esta sessão):
- [ ] Avaliar **Custom GPT** paralelo ao Connector MCP (Actions OpenAPI com system prompt próprio travado)
  — caminho de 100% controle que nem trigger + answer verbatim garantem.

**Débitos técnicos** (inalterados):
- [ ] Wave 3: `update_user_memory()` automático pós-chat.
- [ ] Supabase legado no frontend: 5 páginas importam `@/integrations/supabase/client`.
- [ ] Governance_engine fallback morto: código morto após Pydantic Literal.

### 2026-04-24 (continuação) — Limpar fallback morto + artefatos Custom GPT

**Objetivo**: atacar 2 pendências restantes do sprint anti-contaminação.
#3 (Supabase refactor) e #2 (Wave 3 update_user_memory) ficaram aguardando
decisão de produto — ver plano abaixo.

**Feito** (commit `c14aa73`):
- **`api/governance_engine.py`** — helper `_get_type_config(decision_type)` extrai
  o lookup em `DECISION_TYPES` e levanta `ValueError` explícito quando o tipo não
  existe (defensivo, mas Pydantic `DecisionTypeLiteral` já bloqueia no boundary).
  Os 3 callsites (`check_thresholds` linha 271, `make_readiness_plan` ex-399,
  `govern` ex-491) passaram de `next(..., DECISION_TYPES[2])` — fallback silencioso
  para "strategic" que virou código morto desde a Wave 5 — para o helper novo.
  Suite 66/66 segue verde.
- **`deploy/custom-gpt/`** — 3 artefatos prontos para criar Custom GPT paralelo
  ao Connector MCP:
  - `openapi.yaml` (OpenAPI 3.1, 4 Actions mapeadas para `/api/public/*`)
  - `system-prompt.md` (instructions travadas: "return answer VERBATIM",
    "never generate your own verdict", trigger `LifeOS:`)
  - `README.md` (passo-a-passo completo de criação na OpenAI)
- **`public/openapi-custom-gpt.yaml`** — cópia servida estaticamente
  em `https://lifeos.12brain.org/openapi-custom-gpt.yaml` para "Import from URL"
  no Custom GPT.

**Deploy** (commit `c14aa73` pushado):
- rsync sandbox `lifeos_20260424_1513` → `/var/www/lifeos/` (exclusões padrão).
- `dist/openapi-custom-gpt.yaml` copiado manualmente (vite não re-rodou;
  nenhuma mudança em `src/*` exigia rebuild).
- `pm2 restart lifeos-api` — subiu clean.
- **Smoke**: `/api/health` 200, `/openapi-custom-gpt.yaml` 200 (8431 bytes),
  pytest subset em produção 56/56.

### Pendências depois desta sessão

**#3 Supabase legado — AGUARDANDO DECISÃO DO JOSÉ**

Inventário completo: 12 arquivos, 18 call sites. Distribuição:
- 5 triviais (endpoints já existem 1:1): Dashboard, Evolution, History, memory.ts, useOnboardingCheck
- 2 médios: Channels (remover ref telegram-webhook inline + mapear channel-status), Onboarding
- 5 precisam endpoint novo no backend: DecisionVerdict (GET /api/decisions/:id),
  Plans (GET /api/plans), supabase-utils (2 INSERTs faltantes), audit-logger
  (POST /api/audit-log), feature-flags (ops em feature_flags — whitelist em db_proxy?)

Opções apresentadas (A: só triviais ~1h | B: completo ~3-5h | C: proxies universais |
D: adiar). José prefere…?

**#2 Wave 3 update_user_memory — AGUARDANDO DECISÃO DE PRODUTO**

7 perguntas em aberto (registradas no transcript):
1. Quando extrair? (cada turn / N turns / /remember / fim de sessão / só após SIM?)
2. Qual LLM? (Grok 4.20 / mini / regex?)
3. Custo aceitável/conversa?
4. Dedupe: overwrite ou versioned?
5. Conflito: overwrite ou anotar contradição?
6. Opt-in ou opt-out default?
7. Auto silencioso ou "LifeOS quer lembrar X, confirma?"
