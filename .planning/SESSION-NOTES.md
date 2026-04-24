# LifeOS — SESSION-NOTES

> Estado da última sessão. Ler primeiro ao iniciar nova sessão (Regra 4 do 12Brain).
> Fonte primária do histórico narrativo continua sendo `HISTORICO.md` (no sandbox, não em prod).

## Última sessão: 2026-04-24 — Anti-contaminação ChatGPT: `answer` verbatim + tool descs blindadas + `/connect-gpt` reposicionado

**Status**: CONCLUÍDO e em produção. Commit `363c85a` pushado. Smoke backend verde.

### O que foi feito

Fechou os 2 itens de curto prazo que ficaram da sessão `67a3281`:
1. ✅ Modificar `evaluate_decision` para o ChatGPT não reinterpretar (abordagem: campo `answer`
   verbatim com texto pronto "VEREDITO: ..." + tool descriptions blindadas no MCP).
2. ✅ Disclaimer honesto na `/connect-gpt` sobre possível reinterpretação + apontar `/chat`
   como canal canônico.
3. ✅ Bônus: reposicionamento da `/connect-gpt` para comunicar os **dois caminhos** (ChatGPT
   via Connector vs chat nativo LifeOS), com nome sugerido do Connector, trigger `LifeOS:`
   e exemplos de prompt.

**Contexto recuperado do transcript `d663c7ce` (sessão que caiu no meio)**: 3 de 6 tasks já
estavam prontas no sandbox quando o terminal fechou (sandbox + MCP descs + campo answer).
Esta sessão retomou e finalizou as tasks 4-6.

### Arquivos afetados

Commit `363c85a`:
- `api/public_api.py` — função `format_answer_text(result)` + injeção em `POST /api/public/evaluate`
- `api/mcp/server.py` — 4 tool descriptions reescritas com instruções verbatim
- `src/pages/ConnectGPT.tsx` — header "dois caminhos" + cards + trigger + exemplos + disclaimer
- `api/tests/test_format_answer.py` — 4 testes novos

### Deploy executado

- rsync sandbox `lifeos_20260424_1530` → `/var/www/lifeos/` (exclui .git, .planning, node_modules, .env, bun.lockb, .pytest_cache, dist, HISTORICO.md)
- `dist/` copiado separadamente do sandbox porque prod não tem `vite` global
- `pm2 restart lifeos-api` — pid 1562118, startup clean
- Commit + push para `origin/main` (GitHub `Josepassinato/lifeos`)

### Smoke pós-deploy verde

- `GET /` → 200
- `GET /connect-gpt` → 200
- `GET /api/health` → `{"status":"ok","service":"lifeos-api","ai":"grok-4.20"}`
- `POST /mcp/ tools/list` → 200 com as 4 tools servindo as **descriptions novas blindadas** (verificado grep no response: "CALL THIS TOOL", "VERBATIM", "Do NOT rewrite")
- pm2 logs limpos (startup.ready db_pool_ok, mcp_session_manager_ok)
- `dist/assets/ConnectGPT-BqKzZlFo.js` contém "dois caminhos" e "Aviso honesto"
- pytest subset (10 testes) em /var/www/lifeos/api — 10/10 pós-rsync

### Pendente (validação que só você pode fazer)

- [ ] Abrir https://lifeos.12brain.org/connect-gpt no browser e confirmar visual:
  - 2 cards lado a lado no topo ("ChatGPT + LifeOS" + "Chat nativo LifeOS")
  - Passo 3 com nome do Connector `LifeOS`, 3 exemplos de prompt em fundo cinza
  - Disclaimer âmbar "Aviso honesto" antes do botão Abrir ChatGPT
- [ ] E2E MCP real: reconectar o Connector no ChatGPT Pro (pode já estar ativo com a key `lo_sk_12fqrXnu…`),
  começar mensagem com `LifeOS: ` e conferir se o veredito sai verbatim (campo `answer`).

### Serviços

- PM2 `lifeos-api` online, pid 1562118, bind 8010 — **restart count 1 após esta sessão**
- Nginx `lifeos.12brain.org` → SSL válido, `/mcp/` ativo
- Postgres local `lifeos` — 14 tabelas
- MCP tools: evaluate_decision, list_decisions, get_memory, get_user_context — **descriptions novas em prod**
- API keys ativas: 1 ("chatgpt", prefix `lo_sk_12fqrXnu`)

### Pendências de produto (próximas sessões)

- [ ] Avaliar **Custom GPT** paralelo ao Connector MCP (Actions OpenAPI com system prompt próprio travado)
  — caminho de 100% controle que nem o trigger + answer verbatim fornece totalmente.

### Débitos técnicos herdados

- [ ] Wave 3: `update_user_memory()` automático pós-chat (decisão de produto: quando extrair fatos?)
- [ ] Supabase legado no frontend: 5 páginas ainda importam `@/integrations/supabase/client`
- [ ] Governance_engine fallback morto: `DECISION_TYPES[2]` em 3 pontos após Pydantic Literal no boundary

### Arquivos de referência

- Sandbox atual: `/root/sandbox/lifeos_20260424_1530/` (com .git, pode servir pra próxima sessão após `git pull`)
- Histórico narrativo: `/root/sandbox/lifeos_20260424_1530/HISTORICO.md`
- OS 001 original: `/root/lifeos_ordem_isolamento.json`
- Nginx: `/etc/nginx/sites-enabled/lifeos`
- Docs MCP: `api/mcp/README.md`
- Repo GitHub: `git@github.com:Josepassinato/lifeos.git` (último commit: `363c85a`)
