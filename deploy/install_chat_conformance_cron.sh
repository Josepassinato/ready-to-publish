#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_SRC="${ROOT_DIR}/deploy/lifeos-chat-conformance.cron"
CRON_DST="/etc/cron.d/lifeos-chat-conformance"

if [ ! -f "${CRON_SRC}" ]; then
  echo "Arquivo cron não encontrado: ${CRON_SRC}"
  exit 1
fi

install -m 0644 "${CRON_SRC}" "${CRON_DST}"
mkdir -p /var/log/lifeos
touch /var/log/lifeos/chat_conformance_cron.log

# Keep permissive enough for diagnostics without exposing secrets.
chmod 0644 /var/log/lifeos/chat_conformance_cron.log

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now cron >/dev/null 2>&1 || true
fi

echo "Instalado: ${CRON_DST}"
echo "Cron ativo (preview):"
cat "${CRON_DST}"

