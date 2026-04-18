# LifeOS — Sistema de Governo de Decisão

**Protocolo Luz & Vaso · Constituição Artigos I–VII**

> LifeOS não diz apenas "não". Ele ensina como se tornar capaz do "sim".

## O que é

LifeOS é uma plataforma de governo de decisão que combina um Rules Engine determinístico (Constituição codificada em 7 Artigos) com um LLM controlado para comunicar vereditos. O sistema avalia líderes e decisões em 4 camadas (humana, negócio, financeira, relacional), simula 4 cenários, e emite vereditos binários (**SIM** ou **NÃO AGORA**) com plano de prontidão obrigatório.

## Arquitetura

- **Motor de Governança**: 100% determinístico, client-side, pipeline de 8 passos
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **LLM**: Claude API (Anthropic) via proxy controlado
- **Canais**: Web App, Telegram, WhatsApp
- **Voice**: ElevenLabs STT + TTS

## Setup Local

```bash
git clone <repo-url>
cd lifeos
npm install
cp .env.example .env
npm run dev
```

## Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key
```

### Supabase Edge Functions (Secrets)
```
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
```

## Deploy (VPS + Nginx)

```bash
npm run build
# Arquivos estáticos em dist/ — sirva via Nginx
```

## Monitoramento Diário (Luz & Vaso)

O projeto inclui uma bateria automática de conformidade do chat:

- Script: `api/scripts/luz_vaso_conformance_check.py`
- Runner: `deploy/run_luz_vaso_conformance.sh`
- Agendamento: `deploy/lifeos-chat-conformance.cron`

### O que é validado

1. Saudação inicial e direcionamento de uso.
2. Recusa de tentativas de burlar a Constituição.
3. Exigência de contexto antes de veredito final.

### Instalação do agendamento (VPS)

```bash
sudo bash deploy/install_chat_conformance_cron.sh
```

### Execução manual

```bash
bash deploy/run_luz_vaso_conformance.sh
```

### Logs gerados

- ` /var/log/lifeos/chat_conformance_latest.json `
- ` /var/log/lifeos/chat_conformance_results.jsonl `
- ` /var/log/lifeos/chat_conformance_cron.log `

### Alertas

Se `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` (ou `TELEGRAM_ALERT_CHAT_ID`) estiverem definidos no ambiente, falhas disparam alerta automático no Telegram.

## Licença

Proprietário. Todos os direitos reservados.
