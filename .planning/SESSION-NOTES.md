# LifeOS — SESSION-NOTES

> Estado da última sessão. Ler primeiro ao iniciar nova sessão (Regra 4 do 12Brain).
> Fonte primária do histórico narrativo continua sendo `/var/www/lifeos/HISTORICO.md`.

## Última sessão: 2026-04-20 — Wave 5 + MCP público + Wave B

**Objetivo**: fechar Wave 5 (Pydantic em `POST /api/decisions`), ativar MCP
publicamente para ChatGPT, alinhar FKs user_memory/chat_messages.

**Status**: CONCLUÍDO. Tree clean, `origin/main` sincronizado até `151f462`.

**Commits da sessão**:
- `68e5ada` — Wave 5: DecisionCreate Pydantic + 12 ranges + Literal
- `0ca2617` — MCP público: nginx location + TransportSecuritySettings
- `ef41703` — docs: SESSION-NOTES.md criado
- `151f462` — Wave B: CASCADE em user_memory + chat_messages

### O que foi feito
- **Wave 5** (commit `68e5ada`): `DecisionCreate` BaseModel, 12 scores com `Field(ge=0, le=100)`, `decision_type: DecisionTypeLiteral` do governance_engine. Novo `api/tests/test_decision_validation.py`. Suite 62/62.
- **MCP público** (commit `0ca2617`): `location /mcp/` adicionado em `/etc/nginx/sites-enabled/lifeos`, `TransportSecuritySettings(allowed_hosts=[...])` no `api/mcp/server.py`. `https://lifeos.12brain.org/mcp/` agora retorna 200 em `tools/list`.
- Backup nginx movido de `sites-enabled/` (duplicava server_name) para `/root/nginx-backups/`.
- Sandbox antigo `/root/sandbox/lifeos_20260418_1934` (anterior ao `dd11c75`) removido — 455MB liberados, sem perda (tudo no git).
- Pendência "outros `data: dict` crus" fechada por inspeção (grep retornou 0).

### Serviços
- PM2 `lifeos-api` (id 42) online, bind 8010
- Nginx reloaded OK, SSL válido
- Postgres local `lifeos` — 14 tabelas
- MCP Streamable HTTP em `/mcp/` (tools: evaluate_decision, list_decisions, get_memory, get_user_context)

### Pendências reais
Com bloqueador de **decisão de produto** (não posso resolver sozinho):
- [ ] **Wave 3**: `update_user_memory()` pós-chat. Quando extrair fatos? Sempre? Só msgs >N tokens? Custo aceitável por chamada Grok?
- [ ] **CASCADE em `user_memory`/`chat_messages`**: trocar `ON DELETE NO ACTION` → `CASCADE` (consistência com 6 outras FKs, permite `DELETE FROM users` atômico) OU manter para preservar histórico conversacional?

Com bloqueador operacional (precisa do José):
- [ ] **Teste E2E real no ChatGPT Pro**: configurar Custom Connector → `https://lifeos.12brain.org/mcp/` + Bearer `lo_sk_*` → chamar `evaluate_decision`.

Débitos técnicos remanescentes (tarefa grande, não é limpeza):
- [ ] **Supabase legado no frontend**: 5 páginas (`Chat`, `Dashboard`, `Onboarding`, `History`, `Plans`) ainda importam `@/integrations/supabase/client`. Remover `VITE_SUPABASE_*` quebra build. É refactor — substituir chamadas por `/api/*` do VPS.
- [ ] **UI `/settings/keys`**: frontend para criar/revogar `lo_sk_*` sem depender de `curl POST /api/public/keys` com JWT.
- [ ] **Governance_engine fallback morto**: `next((t for t in DECISION_TYPES if t["id"] == decision_type), DECISION_TYPES[2])` virou código morto depois do Pydantic Literal. Trocar por `raise` defensivo ou deletar.

### Para reabrir o ChatGPT manualmente (sem UI ainda)
```bash
# 1. Login para obter JWT
TOKEN=$(curl -s -X POST https://lifeos.12brain.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"SEU_EMAIL","password":"SUA_SENHA"}' | jq -r .access_token)

# 2. Criar API key (salvar o lo_sk_* — só aparece uma vez)
curl -s -X POST https://lifeos.12brain.org/api/public/keys \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"chatgpt","scopes":["evaluate","read"]}'
```
Depois: ChatGPT Pro → Settings → Connectors → Build your own → Schema MCP, URL `https://lifeos.12brain.org/mcp/`, API Key Bearer = `lo_sk_...`.

### Arquivos de referência
- Histórico narrativo: `HISTORICO.md`
- OS 001 original: `/root/lifeos_ordem_isolamento.json`
- Nginx backups: `/root/nginx-backups/`
- Docs MCP: `api/mcp/README.md`
