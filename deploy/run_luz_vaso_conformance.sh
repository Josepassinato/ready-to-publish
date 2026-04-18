#!/usr/bin/env bash
# Daily runner for Luz & Vaso chat conformance checks.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "${ROOT_DIR}/api/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/api/.env"
  set +a
fi

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

mkdir -p /var/log/lifeos
export LIFEOS_BASE_URL="${LIFEOS_BASE_URL:-https://lifeos.12brain.org}"

exec python3 "${ROOT_DIR}/api/scripts/luz_vaso_conformance_check.py"

