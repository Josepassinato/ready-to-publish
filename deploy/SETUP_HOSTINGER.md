# LifeOS — Deploy na VPS Hostinger

## Resumo Rápido (para quem quer ir direto)

```bash
# 1. Na sua máquina local
git clone https://github.com/Josepassinato/ready-to-publish.git lifeos
cd lifeos

# 2. Configure variáveis
export VPS_HOST="IP-DA-SUA-VPS"
export DOMAIN="seudominio.com.br"
export VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sua-anon-key"

# 3. Deploy!
./deploy/deploy.sh
```

---

## Guia Detalhado

### Etapa 1 — Preparar a VPS Hostinger

1. Acesse o **hPanel da Hostinger** → **VPS** → seu plano
2. Anote o **IP** da VPS (ex: `154.49.xx.xx`)
3. Garanta que tem **acesso SSH** configurado (chave ou senha)
4. Teste a conexão:

```bash
ssh root@154.49.xx.xx
# Se conectou → siga em frente
# Se não → configure SSH key no painel da Hostinger
```

### Etapa 2 — Configurar DNS

No painel da Hostinger (ou do seu registrador de domínio):

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | @ | IP-DA-VPS | 3600 |
| A | www | IP-DA-VPS | 3600 |

⏳ Aguarde propagação (geralmente 10-30 min, pode levar até 24h).

Verifique: `dig seudominio.com.br` — deve retornar o IP da VPS.

### Etapa 3 — Preparar o Supabase

No [dashboard do Supabase](https://supabase.com/dashboard):

1. Acesse seu projeto
2. Vá em **Settings → API** e copie:
   - `Project URL` (ex: `https://abcdef.supabase.co`)
   - `anon public` key
3. Vá em **Edge Functions → Secrets** e adicione:
   - `ANTHROPIC_API_KEY` = `sk-ant-api03-sua-chave` ([criar aqui](https://console.anthropic.com))
   - `ELEVENLABS_API_KEY` = sua chave (opcional, para voz)

### Etapa 4 — Deploy

Na sua máquina local:

```bash
# Clone o repositório
git clone https://github.com/Josepassinato/ready-to-publish.git lifeos
cd lifeos

# Configure as variáveis de ambiente
export VPS_HOST="154.49.xx.xx"
export DOMAIN="seudominio.com.br"
export VITE_SUPABASE_URL="https://abcdef.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi..."

# Execute o deploy
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

O script automaticamente:
- ✅ Faz o build do projeto
- ✅ Instala Nginx e Certbot na VPS
- ✅ Envia os arquivos via rsync
- ✅ Configura o Nginx (SPA routing, gzip, cache, headers)
- ✅ Gera certificado SSL (HTTPS)

### Etapa 5 — Deploy das Edge Functions (Supabase)

```bash
# Instale Supabase CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Linke ao projeto
supabase link --project-ref SEU-PROJECT-REF

# Deploy das functions
supabase functions deploy chat
supabase functions deploy telegram-webhook
supabase functions deploy whatsapp-webhook
supabase functions deploy channel-status
supabase functions deploy elevenlabs-stt
supabase functions deploy elevenlabs-tts
supabase functions deploy elevenlabs-scribe-token
```

### Etapa 6 — Testar

1. **Desktop**: Abra `https://seudominio.com.br`
2. **Mobile**: Abra no Chrome → menu (⋮) → "Adicionar à tela inicial"
3. **iOS**: Safari → Compartilhar (⬆) → "Adicionar à Tela de Início"
4. **PWA**: O ícone do LifeOS (escudo azul) aparecerá como app

Verificações:
- [ ] Página carrega com tema escuro
- [ ] Login/cadastro funciona
- [ ] Onboarding completa
- [ ] Chat responde (precisa da ANTHROPIC_API_KEY)
- [ ] Formulário de decisão funciona
- [ ] Veredito SIM/NÃO AGORA aparece
- [ ] PWA instala com ícone correto

---

## Atualizações Futuras

```bash
cd lifeos
git pull
export VITE_SUPABASE_URL="..." VITE_SUPABASE_PUBLISHABLE_KEY="..."
./deploy/deploy.sh
```

## Deploy Manual (alternativa ao script)

Se preferir fazer manualmente:

```bash
# Build local
npm install
npm run build

# Upload via scp
scp -r dist/* root@IP-DA-VPS:/var/www/lifeos/dist/

# Na VPS, configure Nginx manualmente
# (veja deploy/nginx.conf como referência)
```

## Troubleshooting

| Problema | Solução |
|----------|---------|
| **502 Bad Gateway** | Verifique `root /var/www/lifeos/dist;` no Nginx |
| **Page not found em /chat** | Confirme `try_files $uri $uri/ /index.html;` |
| **Chat não responde** | ANTHROPIC_API_KEY no Supabase Secrets + redeploy `chat` |
| **SSL falha** | DNS precisa ter propagado. Verifique com `dig seudominio.com.br` |
| **Tela branca** | Abra DevTools → Console. Provavelmente Supabase URL/Key errada |
| **PWA não instala** | Precisa de HTTPS ativo |
| **Ícone errado no celular** | Limpe cache do browser, ou remova/readicione o PWA |

## Estrutura na VPS

```
/var/www/lifeos/
  └── dist/
      ├── index.html
      ├── favicon.svg
      ├── manifest.json
      ├── sw.js
      ├── icons/
      │   ├── icon-192x192.png
      │   ├── icon-512x512.png
      │   ├── icon-maskable-512x512.png
      │   └── ...
      ├── splash/
      │   └── ...
      └── assets/
          ├── index-xxx.js
          └── index-xxx.css
```
