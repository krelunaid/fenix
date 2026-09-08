#!/usr/bin/env bash
# One-shot setup of a Fenix agent host on a fresh Ubuntu 24.04 VM (Hetzner/OVH/Scaleway…).
# Usage (as root):  bash install-vm.sh https://github.com/krelunaid/fenix.git main
set -euo pipefail
REPO="${1:-https://github.com/krelunaid/fenix.git}"
BRANCH="${2:-main}"
APP_DIR=/opt/fenix
DATA_DIR=/var/lib/fenix-agent
ENV_FILE=/etc/fenix-agent.env

echo "== pacchetti"
apt-get update -y
apt-get install -y ca-certificates curl git ufw
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "== utente e cartelle"
id -u fenix >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin fenix
usermod -aG docker fenix
mkdir -p "$APP_DIR" "$DATA_DIR"
chown -R fenix:fenix "$DATA_DIR"

echo "== codice"
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" fetch -q && git -C "$APP_DIR" checkout -q "$BRANCH" && git -C "$APP_DIR" pull -q; else git clone -q -b "$BRANCH" "$REPO" "$APP_DIR"; fi
chown -R fenix:fenix "$APP_DIR"

echo "== immagine sandbox"
docker build -t fenix-agent-sandbox:local "$APP_DIR/workers/agent/sandbox"

echo "== configurazione"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<ENV
# Fenix agent host — server only. Compila e riavvia: systemctl restart fenix-agent
AGENT_TOKEN=$(openssl rand -hex 24)
AGENT_SANDBOX=docker
AGENT_DATA_DIR=$DATA_DIR
AGENT_CONCURRENCY=2
AGENT_PROVIDER=anthropic
ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# XAI_API_KEY=
FENIX_ORIGIN=https://fenix.kreluna.it
PORT=8790
ENV
  chmod 600 "$ENV_FILE"
  echo "   scritto $ENV_FILE — inserisci ANTHROPIC_API_KEY"
fi

echo "== servizio"
install -m 644 "$APP_DIR/workers/agent/deploy/fenix-agent.service" /etc/systemd/system/fenix-agent.service
systemctl daemon-reload
systemctl enable --now fenix-agent

echo "== firewall (solo SSH; l'agente resta su loopback, davanti va un reverse proxy TLS)"
ufw allow OpenSSH >/dev/null || true
ufw --force enable >/dev/null || true

echo
echo "Fatto. Token per Netlify (AGENT_TOKEN):"
grep ^AGENT_TOKEN= "$ENV_FILE"
echo "Health: curl -s http://127.0.0.1:8790/health"
echo "Prossimo passo: reverse proxy TLS (Caddy) → workers/agent/deploy/Caddyfile.example"
