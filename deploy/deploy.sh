#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  LifeOS — Deploy para VPS Hostinger
#  Uso: ./deploy/deploy.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── CONFIGURAÇÃO (edite antes de rodar) ───────────────────────
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-}"                    # IP da VPS Hostinger
VPS_PATH="/var/www/lifeos"
DOMAIN="${DOMAIN:-}"                        # Seu domínio
SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SUPABASE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"

# ── Validação ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

check_var() {
  if [ -z "${!1:-}" ]; then
    echo -e "${RED}❌ Variável $1 não definida.${NC}"
    echo "   Exporte antes de rodar: export $1=\"valor\""
    exit 1
  fi
}

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     LifeOS — Deploy Script           ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

check_var VPS_HOST
check_var DOMAIN
check_var VITE_SUPABASE_URL
check_var VITE_SUPABASE_PUBLISHABLE_KEY

echo -e "  VPS:    ${GREEN}${VPS_USER}@${VPS_HOST}${NC}"
echo -e "  Domain: ${GREEN}${DOMAIN}${NC}"
echo -e "  Supa:   ${GREEN}${VITE_SUPABASE_URL}${NC}"
echo ""

# ── 1. Build ──────────────────────────────────────────────────
echo -e "${BLUE}[1/5] Building...${NC}"

if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Execute este script da raiz do projeto.${NC}"
  exit 1
fi

npm install --silent 2>/dev/null
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ Build falhou — dist/ não encontrado.${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓ Build: $(du -sh dist | cut -f1)${NC}"

# ── 2. Testar SSH ─────────────────────────────────────────────
echo -e "${BLUE}[2/5] Testando conexão SSH...${NC}"

ssh -o ConnectTimeout=10 -o BatchMode=yes ${VPS_USER}@${VPS_HOST} "echo ok" > /dev/null 2>&1 || {
  echo -e "${RED}❌ Não consegui conectar via SSH em ${VPS_HOST}${NC}"
  echo "   Verifique: ssh ${VPS_USER}@${VPS_HOST}"
  exit 1
}

echo -e "${GREEN}  ✓ SSH conectado${NC}"

# ── 3. Preparar servidor ──────────────────────────────────────
echo -e "${BLUE}[3/5] Preparando servidor...${NC}"

ssh ${VPS_USER}@${VPS_HOST} << REMOTE_SETUP
set -e

# Criar diretório
mkdir -p ${VPS_PATH}/dist

# Instalar Nginx se não tiver
if ! command -v nginx &> /dev/null; then
  echo "  Instalando Nginx..."
  apt-get update -qq && apt-get install -y -qq nginx > /dev/null
fi

# Instalar Certbot se não tiver
if ! command -v certbot &> /dev/null; then
  echo "  Instalando Certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx > /dev/null
fi

echo "  ✓ Servidor pronto"
REMOTE_SETUP

echo -e "${GREEN}  ✓ Dependências verificadas${NC}"

# ── 4. Upload ─────────────────────────────────────────────────
echo -e "${BLUE}[4/5] Enviando arquivos...${NC}"

rsync -avz --delete --progress \
  dist/ ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/dist/

echo -e "${GREEN}  ✓ Arquivos sincronizados${NC}"

# ── 5. Configurar Nginx + SSL ─────────────────────────────────
echo -e "${BLUE}[5/5] Configurando Nginx...${NC}"

ssh ${VPS_USER}@${VPS_HOST} << REMOTE_NGINX
set -e

# Criar config do Nginx
cat > /etc/nginx/sites-available/lifeos << 'NGINX_CONF'
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${VPS_PATH}/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # Cache static assets (Vite hashes filenames)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service worker — never cache
    location = /sw.js {
        expires off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Manifest — short cache
    location = /manifest.json {
        expires 1d;
        add_header Cache-Control "public";
    }

    # SPA fallback
    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(self), geolocation=()" always;
}
NGINX_CONF

# Ativar site
ln -sf /etc/nginx/sites-available/lifeos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar config
nginx -t

# Reload
systemctl reload nginx

echo "  ✓ Nginx configurado"

# SSL — só se ainda não tiver certificado
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  echo "  Gerando certificado SSL..."
  certbot --nginx \
    -d ${DOMAIN} -d www.${DOMAIN} \
    --non-interactive --agree-tos \
    --email admin@${DOMAIN} \
    --redirect \
    || echo "  ⚠️  SSL precisa de atenção manual (DNS propagou?)"
else
  echo "  ✓ SSL já configurado"
fi

REMOTE_NGINX

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ LifeOS deployed!${NC}"
echo -e "${GREEN}  🌐 https://${DOMAIN}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Próximos passos:${NC}"
echo "  1. Teste: abra https://${DOMAIN} no celular"
echo "  2. PWA: 'Adicionar à Tela Inicial' no Chrome/Safari"
echo "  3. Supabase: configure ANTHROPIC_API_KEY nos Secrets"
echo "  4. Edge Functions: supabase functions deploy chat"
