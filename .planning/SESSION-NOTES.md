# LifeOS — SESSION-NOTES

> Estado da última sessão. Ler primeiro ao iniciar nova sessão (Regra 4 do 12Brain).
> Fonte primária do histórico narrativo continua sendo `HISTORICO.md` (no sandbox, não em prod).

## Última sessão: 2026-04-24 (continuação) — Fallback morto limpo + artefatos Custom GPT

**Status**: PARCIAL — 2 de 4 pendências concluídas e deployadas; 2 aguardando decisão do José.

### Entregue e em produção (commits `363c85a`, `6dba97a`, `c14aa73`)

- ✅ `/connect-gpt` reposicionado (dois caminhos + trigger + disclaimer)
- ✅ Campo `answer` verbatim no `POST /api/public/evaluate`
- ✅ 4 tool descriptions MCP blindadas
- ✅ **Governance engine fallback morto removido** — `_get_type_config()` helper +
  raise defensivo nos 3 callsites. Pydantic `DecisionTypeLiteral` já bloqueia
  no boundary, fallback era código morto silencioso.
- ✅ **Artefatos Custom GPT** prontos em `deploy/custom-gpt/`:
  `openapi.yaml` + `system-prompt.md` + `README.md`. Spec também servido em
  `https://lifeos.12brain.org/openapi-custom-gpt.yaml`. José cria o GPT na
  OpenAI manualmente seguindo o README.

### AGUARDANDO decisão do José

**#3 Supabase legado no frontend**

Inventário revisado: **12 arquivos, 18 call sites** (não 5 como o SESSION-NOTES
anterior sugeria). Distribuição:
- 5 triviais (endpoint `/api/*` já existe 1:1): `Dashboard.tsx`, `Evolution.tsx`,
  `History.tsx`, `lib/memory.ts`, `hooks/useOnboardingCheck.ts`
- 2 médios: `Channels.tsx` (remover telegram-webhook inline que é callback externo,
  mapear channel-status), `Onboarding.tsx`
- 5 precisam endpoint backend novo:
  - `DecisionVerdict.tsx` → `GET /api/decisions/:id` (novo)
  - `Plans.tsx` → `GET /api/plans` (novo)
  - `lib/supabase-utils.ts` → `POST /api/readiness-plans` + `POST /api/state-classifications` (novos)
  - `lib/audit-logger.ts` → `POST /api/audit-log` OU expor `governance_audit_log` no db_proxy
  - `lib/feature-flags.ts` → db_proxy whitelist para `feature_flags` OU endpoint dedicado

**Opções apresentadas** (aguardando escolha):
- A) Só os 5 triviais (~1h). Reduz 42% do débito, elimina trabalho sem backend novo.
- B) Completo: 5 endpoints + 12 arquivos. 3-5h, risco visual em várias telas.
- C) Expandir `/api/rpc/{fn}` + `/api/db/{table}` universais.
- D) Adiar: Supabase legado FUNCIONA hoje; só o `VITE_SUPABASE_*` fica no .env.

Nesta sessão recomendei A. José está decidindo.

**#2 Wave 3 `update_user_memory()` pós-chat**

7 perguntas de produto em aberto:
1. **Quando extrair fatos?** cada turn / cada N turns / só com `/remember` / fim de sessão / só quando verdict=SIM
2. **Qual LLM?** Grok 4.20 (caro, disponível) / gpt-4o-mini / regex-heurística
3. **Custo aceitável/conversa?** (Grok ~10 turns ≈ $0.02-0.05)
4. **Dedupe**: `(category, key)` overwrite `updated_at` ou versões históricas?
5. **Conflito de fatos**: sobrescrever ou anotar contradição?
6. **Opt-in ou opt-out default?**
7. **Confirmação humana**: auto-silencioso ou "LifeOS quer lembrar: X. Confirma?"

Não implementável sem essas decisões.

### Serviços (inalterados)

- PM2 `lifeos-api` online, pid novo pós-restart desta sessão, bind 8010
- Nginx `lifeos.12brain.org` → SSL, `/mcp/` ativo
- Postgres local `lifeos` — 14 tabelas
- MCP tools: 4 servindo descriptions blindadas
- API keys ativas: 1 (`lo_sk_12fqrXnu…`)

### Smoke pós-deploy desta continuação (verde)

- `GET /api/health` → 200
- `GET /openapi-custom-gpt.yaml` → 200 (8431 bytes, YAML servido)
- pytest produção subset → 56/56 (test_governance_engine 55 + test_decision_validation 1)
- pm2 logs: startup clean, requests normais

### Arquivos de referência

- Sandbox atual: `/root/sandbox/lifeos_20260424_1513/`
- Sandbox anterior: `/root/sandbox/lifeos_20260424_1530/` (pode ser limpa — desatualizado)
- Repo: `git@github.com:Josepassinato/lifeos.git` — último commit `c14aa73`
- Histórico narrativo: `/root/sandbox/lifeos_20260424_1513/HISTORICO.md`
- OS 001 original: `/root/lifeos_ordem_isolamento.json`

### Próxima sessão deve começar perguntando

1. "Qual opção para #3 Supabase (A/B/C/D)?"
2. "Quer responder as 7 perguntas de Wave 3 ou pula?"
3. Se #1 e #2 resolvidos, partir para pendência nova ou outra coisa.
