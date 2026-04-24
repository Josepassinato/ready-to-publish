# LifeOS Custom GPT — deployment guide

Arquivos nesta pasta:
- `openapi.yaml` — spec OpenAPI 3.1 das 4 Actions (para colar em "Schema" do Custom GPT).
- `system-prompt.md` — prompt travado (para colar em "Instructions").
- `README.md` — este documento.

## Por que Custom GPT, se já temos o Connector MCP

- **Custom Connector MCP** (já em produção em `/mcp/`) não dá controle sobre o system prompt — o
  ChatGPT principal é quem orquestra e pode reinterpretar o verdict.
- **Custom GPT com Actions** (OpenAPI) permite **system prompt travado** que você escreve. É o
  caminho mais próximo de "verbatim garantido" disponível hoje.
- Os dois podem coexistir: Connector MCP como atalho inline, Custom GPT como experiência
  dedicada "LifeOS" separada no ChatGPT.

## Pré-requisitos

- Conta **ChatGPT Plus**, **Pro**, **Team** ou **Enterprise** (qualquer plano que libera "My GPTs").
- Chave API `lo_sk_*` ativa em `https://lifeos.12brain.org/connect-gpt` (você já tem uma: `lo_sk_12fqrXnu…`).

## Passo-a-passo (≈5 minutos)

### 1. Criar o GPT
1. Abra https://chatgpt.com/gpts/editor (ou no app → topo → **Create a GPT**).
2. Clique na aba **Configure** (lado direito).
3. Campos iniciais:
   - **Name**: `LifeOS`
   - **Description**: `Governo de decisão. Protocolo Luz & Vaso, deterministic.`
   - **Logo**: opcional. Se quiser, use o favicon/logo do app.

### 2. Colar o system prompt
1. Campo **Instructions** (texto grande).
2. Abra `deploy/custom-gpt/system-prompt.md`, copie o conteúdo abaixo do cabeçalho
   (a partir de `You are **LifeOS**…`) e cole.
3. Em **Conversation starters**, sugestões:
   - `LifeOS: me dá meu contexto atual`
   - `LifeOS: lista minhas últimas decisões`
   - `LifeOS: devo contratar um designer por 30 dias?`

### 3. Configurar a Action
1. Role até **Actions** → **Create new action**.
2. Em **Authentication**:
   - Type: **API Key**
   - Auth Type: **Bearer**
   - API Key: cole sua `lo_sk_…` de `https://lifeos.12brain.org/connect-gpt`.
3. Em **Schema**:
   - Clique em **Import from URL** **OU** cole o conteúdo de `openapi.yaml` direto.
   - URL direta (servida junto com o dist, acessível sem auth):
     `https://lifeos.12brain.org/openapi-custom-gpt.yaml` (ver seção "Hospedar o schema" abaixo).
4. Em **Privacy policy URL** (obrigatório pra publicar): use a URL do app, ex. `https://lifeos.12brain.org/terms`.
5. Confirme que as 4 operações aparecem: `evaluateDecision`, `listDecisions`, `getMemory`, `getUserContext`.

### 4. Testar

No painel direito ("Preview"):

```
LifeOS: devo contratar um designer freelancer por 30 dias?
```

Esperado:
- GPT chama `evaluateDecision` (talvez pedindo 1-2 inputs faltantes primeiro).
- Volta o campo `answer` verbatim — bloco começando com `VEREDITO: ...`.

Também testar:
```
LifeOS: me dá meu contexto atual
→ deve chamar getUserContext

LifeOS: lista minhas últimas decisões
→ deve chamar listDecisions

O que LifeOS sabe sobre mim?
→ deve chamar getMemory
```

### 5. Publicar
- Topo direito → **Save** → escolha visibilidade:
  - **Only me**: uso pessoal.
  - **Anyone with a link**: pode compartilhar publicamente (mas a Action exige que cada usuário
    cole a própria `lo_sk_*` — então funciona só pra quem tem conta no LifeOS).
  - **Public (GPT Store)**: requer que o domínio seja verificado e uma política de privacidade
    robusta. Não recomendado até ter isso pronto.

## Hospedar o schema (opcional)

Se quiser que o Custom GPT puxe `openapi.yaml` via URL em vez de colar texto:

```bash
# No servidor, copiar o arquivo pro public/ pra servir estático
cp /var/www/lifeos/deploy/custom-gpt/openapi.yaml /var/www/lifeos/public/openapi-custom-gpt.yaml
# Vite serve tudo em public/ no root — acessível em:
# https://lifeos.12brain.org/openapi-custom-gpt.yaml
```

Depois no Custom GPT → Actions → **Import from URL** com essa URL.

## Diferenças vs. o Connector MCP

| Aspecto | Custom Connector MCP | Custom GPT + Actions |
|---|---|---|
| System prompt | Não controlável | Controlável (você escreve) |
| Transport | MCP Streamable HTTP | REST HTTP |
| UI | Inline em qualquer chat | GPT dedicado |
| Blindagem verbatim | Atenuada (tool description) | Forte (system prompt travado) |
| Autenticação | Bearer | Bearer |
| Endpoint | `/mcp/` | `/api/public/*` |

Ambos funcionam simultaneamente. Use Custom GPT como experiência "LifeOS puro" e o Connector
como atalho inline.

## Troubleshooting

- **"Action returns 401"**: API key inválida/revogada. Abra `/connect-gpt`, gere nova, atualize na Action.
- **"GPT não chama a tool"**: reforce o trigger `LifeOS:` no prompt. Verifique que o system prompt
  foi colado inteiro. Em último caso, escreva "use a ferramenta evaluateDecision" explicitamente.
- **"Schema inválido"**: o OpenAPI 3.1 do ChatGPT é estrito sobre `nullable: true` (use `type: ["string", "null"]`
  se der erro). A versão atual usa `nullable: true` que é válido em 3.1; se ChatGPT reclamar, migre para a sintaxe de array.

## Manutenção

Se algum endpoint mudar em `api/public_api.py`, regenerar o `openapi.yaml`:
1. Revisar pydantic models em `public_api.py` (linhas 203-251).
2. Atualizar a seção `components.schemas` aqui.
3. Re-importar no Custom GPT (ou editar manualmente).

A spec atual reflete o estado do commit `363c85a` + `answer` verbatim.
