# LifeOS — SESSION-NOTES

> Estado da última sessão. Ler primeiro ao iniciar nova sessão (Regra 4 do 12Brain).
> Fonte primária do histórico narrativo continua sendo `HISTORICO.md` (no sandbox).

## Última sessão: 2026-04-24 (três continuações) — Anti-contaminação + /remember MVP + refactor parcial Supabase

**Status**: CONCLUÍDA. 5 commits deployados:
- `363c85a` — answer verbatim + tool descs blindadas + /connect-gpt dois caminhos
- `6dba97a` — docs
- `c14aa73` — DECISION_TYPES[2] fallback morto removido + artefatos Custom GPT
- `1443f10` — docs
- `d8d52b2` — /remember MVP + refactor 5 arquivos Supabase (Dashboard, Evolution, History, memory.ts, useOnboardingCheck)

### Em produção agora

- Backend: `POST /api/memory/remember` (Grok JSON extraction + upsert)
- Frontend: Chat intercepta `/remember <fato>` → fala com endpoint → feedback visual
- 5 páginas/hooks migrados do Supabase para `/api/*` via novo `src/lib/api.ts` (helper Bearer)
- Governance engine sem fallback silencioso para "strategic" em tipos inválidos
- `/connect-gpt` com dois caminhos + trigger + disclaimer
- `https://lifeos.12brain.org/openapi-custom-gpt.yaml` servido para Custom GPT Actions
- Tool descriptions MCP blindadas + campo `answer` verbatim no evaluate

### Serviços

- PM2 `lifeos-api` online, bind 8010, restart count atualizado nesta sessão
- Nginx `lifeos.12brain.org` → SSL, `/mcp/` ativo
- Postgres local `lifeos` — 14 tabelas
- MCP tools: 4 com descriptions blindadas
- API keys ativas: 1 (`lo_sk_12fqrXnu…`)

### Pendências ainda abertas

**Refactor Supabase dos 7 arquivos restantes** (prioridade baixa — funciona hoje):
- `Plans.tsx` (whitelist ok, só trocar)
- `DecisionVerdict.tsx` (precisa `GET /api/decisions/:id` novo)
- `lib/supabase-utils.ts` (3 INSERTs via db_proxy — whitelist ok)
- `lib/audit-logger.ts` (db_proxy — whitelist ok)
- `lib/feature-flags.ts` (precisa whitelist `feature_flags` em db_proxy)
- `Channels.tsx` (remover `telegram-webhook` inline, é callback externo)
- `Onboarding.tsx` (migrar pra `/api/memory/import` + `PUT /api/profile`)

**Wave 3 automação** (decisões ainda em aberto, MVP manual resolve 70%):
- Se usuário usar `/remember` e sentir falta de automático, adicionar hook pós-chat
  que dispare quando Grok emitir sinal `[[remember: ...]]` na resposta.

**Custom GPT manual** (depende só do José):
- Criar Custom GPT na OpenAI seguindo `deploy/custom-gpt/README.md` — leva ~5 min.
- Schema URL: `https://lifeos.12brain.org/openapi-custom-gpt.yaml` (já servido).

### Validação do que você precisa testar no browser

1. Abra `https://lifeos.12brain.org/chat`
2. Envie `/remember minha empresa se chama Increase Trainer Inc`
3. Deve aparecer "Salvo na memória. **personal/professional → company_name**: ..."
4. Pergunte em mensagem normal "Qual é minha empresa?" — Grok deve saber (memoryContext refreshed)
5. Bônus: abra `/dashboard`, `/history`, `/evolution` — devem renderizar normal
   (são os refactorados; se algo quebrar, é ali)

### Arquivos de referência

- Sandbox atual: `/root/sandbox/lifeos_20260424_1513/` (com .git)
- Sandbox anterior: `/root/sandbox/lifeos_20260424_1530/` (mantido como fonte de node_modules — symlink)
- Repo: `git@github.com:Josepassinato/lifeos.git` — último commit `d8d52b2`
- Histórico: `/root/sandbox/lifeos_20260424_1513/HISTORICO.md`
- OS 001: `/root/lifeos_ordem_isolamento.json`

### Próxima sessão começa perguntando

1. Testou `/remember` e os 3 dashboards refatorados? Funcionou?
2. Quer fechar os 7 arquivos Supabase restantes agora ou adiar?
3. Criou o Custom GPT? (Se sim, testou E2E com trigger `LifeOS:`?)
