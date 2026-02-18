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

## Licença

Proprietário. Todos os direitos reservados.
