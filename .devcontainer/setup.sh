#!/usr/bin/env bash
# One-time setup when the codespace is created.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Python packages"
python -m venv backend/.venv
backend/.venv/bin/pip install -q --upgrade pip
backend/.venv/bin/pip install -q -r backend/requirements.txt

echo "== Training the message checker"
(cd backend && .venv/bin/python -m app.classifier > /dev/null)

echo "== npm packages"
npm ci --no-audit --no-fund

if [ ! -f .env ]; then
  echo "== Creating .env (random JWT secret, short test timers)"
  cp .env.example .env
  secret=$(python -c 'import secrets; print(secrets.token_hex(32))')
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${secret}/" .env
  # Short timers so testers don't wait hours. Change them here for real-world values.
  sed -i 's/^SAVE_FOR_LATER_OPTIONS_MINUTES=.*/SAVE_FOR_LATER_OPTIONS_MINUTES=1,3,5/' .env
  sed -i 's/^TRUSTED_CONTACT_TIMEOUT_MINUTES=.*/TRUSTED_CONTACT_TIMEOUT_MINUTES=2/' .env
  sed -i 's/^HANG_UP_WAIT_MINUTES=.*/HANG_UP_WAIT_MINUTES=1/' .env
fi

echo "== Setup done"
