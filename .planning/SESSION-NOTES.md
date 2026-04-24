# LifeOS — SESSION-NOTES

> Estado da última sessão. Ler primeiro ao iniciar nova sessão (Regra 4 do 12Brain).
> Fonte primária do histórico narrativo continua sendo `/var/www/lifeos/HISTORICO.md`.

## Última sessão: 2026-04-24 — UI para ChatGPT + paste no onboarding

**Objetivo**: criar painel intuitivo `/connect-gpt` para o usuário gerar/revogar
API keys e ver instruções de conexão ao ChatGPT Pro, sem depender de curl.
Adicionar opção de **colar texto** na etapa de import do onboarding (além do upload).

**Status**: CONCLUÍDO e em produção. Testado via Playwright.

### O que foi feito
- **Nova página** `src/pages/ConnectGPT.tsx` (390 linhas): lista keys (GET), cria
  nova (POST com modal de exibição única da `lo_sk_*`), revoga (POST revoke),
  card com URL do MCP copiável, instruções passo-a-passo do ChatGPT Pro,
  lista dos 4 tools disponíveis. Reutiliza `useAuth.getToken` e shadcn Dialog/Card/Badge.
- **Rota** `/connect-gpt` adicionada em `src/App.tsx` (lazy-loaded).
- **Item de menu** "Conectar GPT" (ícone Sparkles) em `src/components/AppLayout.tsx`,
  visível desktop + mobile (cai no "Mais" no mobile).
- **Onboarding step 4**: trocado o upload único por Tabs com 2 modos — "Colar texto"
  (Textarea + botão "Processar JSON") e "Upload .json" (comportamento antigo preservado).
  Mesmo extrator (`extractJsonFromText` + `validateFacts`). Novo estado
  `importSource`/`pastedText`, novo helper `handleImportPaste` e `clearImport`.
- Backend intocado — endpoints `POST/GET /api/public/keys` e `POST /api/public/keys/{id}/revoke`
  já existiam em `api/public_api.py`.

### Deploy
- Sandbox: `/root/sandbox/lifeos_20260424_1424`
- Build: `npm run build` verde no sandbox (ConnectGPT-DAn5mshF.js 12.28kB).
- rsync sandbox → /var/www/lifeos (excluindo .env, .git, node_modules, .planning, HISTORICO.md, bun.lockb).
- Frontend estático, sem restart PM2.
- Smoke: `GET /api/public/keys` com JWT → 200 (1 key "chatgpt" ativa).
- Playwright: login OK → `/connect-gpt` renderiza com a key existente, instruções,
  URL MCP visível e copiável → `/onboarding` step 4 com tabs Paste/Upload, paste ativo default.
- Screenshots salvos em `/tmp/lifeos-02-connect-gpt.png` e `/tmp/lifeos-04-onboarding-paste-tab.png`.

### Discussão de produto registrada (não-implementada ainda)
José recebeu análise do ChatGPT sobre "contaminação" de resposta do LLM quando orquestra
MCP tools. Conclusão conjunta nesta sessão:

- Custom Connector MCP **não tem system prompt editável** pelo usuário; o ChatGPT pode
  ignorar a `description` da tool.
- Atenuar com trigger `"LifeOS:"` é hack, não solução.
- Caminho real: (a) aceitar que ChatGPT é UX de entrada, não canal autoritativo; verdict
  canônico fica no app/Telegram/WhatsApp; (b) futuramente construir **Custom GPT com Actions**
  (OpenAPI, não MCP) em paralelo ao Connector — system prompt próprio travado.
- Ação de curto prazo: adicionar aviso honesto na `/connect-gpt` e considerar retornar
  `{verdict_preview, canonical_url}` em `evaluate_decision` em vez do verdict inteiro.
- **Ainda não implementado**. Fica de próxima sessão.

### Serviços
- PM2 `lifeos-api` (id 39/42) online, bind 8010
- Nginx `lifeos.12brain.org` → SSL válido, /mcp/ ativo
- Postgres local `lifeos` — 14 tabelas
- MCP tools: evaluate_decision, list_decisions, get_memory, get_user_context
- API keys ativas: 1 ("chatgpt", prefix `lo_sk_12fqrXnu`)

### Pendências
Backlog de produto (Custom GPT + canal autoritativo):
- [ ] Adicionar disclaimer na `/connect-gpt` sobre ChatGPT ser entrada, não canal autoritativo.
- [ ] Modificar `evaluate_decision` para retornar `{verdict_preview, canonical_url}` em vez do verdict completo.
- [ ] Avaliar construir Custom GPT paralelo ao Connector MCP (Actions OpenAPI).

Débitos técnicos herdados:
- [ ] **Wave 3**: `update_user_memory()` pós-chat (decisão de produto).
- [ ] **Supabase legado no frontend**: 5 páginas ainda importam `@/integrations/supabase/client`
  (incluindo `Onboarding.tsx` e `Channels.tsx`). Remover `VITE_SUPABASE_*` quebra build.
- [ ] **Governance_engine fallback morto**: código morto após Pydantic Literal.

### Arquivos de referência
- Histórico narrativo: `HISTORICO.md`
- OS 001 original: `/root/lifeos_ordem_isolamento.json`
- Nginx: `/etc/nginx/sites-enabled/lifeos`
- Docs MCP: `api/mcp/README.md`
