#!/usr/bin/env bash
# Grandpa's Sidekick — installer for Raspberry Pi OS.
# Run from the gpa-sidekick repo root:    ./scripts/install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="${SUDO_USER:-$USER}"

echo "==> Repo: $REPO_DIR"
echo "==> User: $USER_NAME"

echo "==> Installing system packages (apt)"
sudo apt-get update
# chromium-browser on Bullseye, chromium on Bookworm — install whichever is available.
sudo apt-get install -y python3 python3-venv python3-pip unclutter curl
sudo apt-get install -y chromium-browser 2>/dev/null || sudo apt-get install -y chromium
# Color emoji font — without this, Chromium renders weather/holiday emoji as blank boxes.
sudo apt-get install -y fonts-noto-color-emoji
fc-cache -f >/dev/null 2>&1 || true

echo "==> Creating Python virtualenv at $REPO_DIR/.venv"
python3 -m venv "$REPO_DIR/.venv"
"$REPO_DIR/.venv/bin/pip" install --upgrade pip
"$REPO_DIR/.venv/bin/pip" install -r "$REPO_DIR/requirements.txt"

echo "==> Setting up config"
if [ ! -f "$REPO_DIR/config.json" ]; then
  cp "$REPO_DIR/config.example.json" "$REPO_DIR/config.json"
  echo "    Created config.json — EDIT IT to add the Google Calendar private iCal URL."
else
  echo "    config.json already exists — leaving it alone."
fi

echo "==> Installing systemd service (auto-restart on crash, auto-start on boot)"
SERVICE_FILE=/etc/systemd/system/gpa-sidekick.service
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Grandpa's Sidekick (local dashboard)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$REPO_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$REPO_DIR/.venv/bin/python $REPO_DIR/app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable gpa-sidekick.service
sudo systemctl restart gpa-sidekick.service
sleep 2

echo
echo "==> Installation complete."
echo
sudo systemctl --no-pager --lines=5 status gpa-sidekick.service || true
echo
echo "Next steps:"
echo "  1. Edit ${REPO_DIR}/config.json — paste your Google Calendar private iCal URL."
echo "     (Google Calendar -> Settings -> [your calendar] -> Integrate calendar -> 'Secret address in iCal format')"
echo "  2. sudo systemctl restart gpa-sidekick   # apply config changes"
echo "  3. ./scripts/setup-kiosk.sh              # auto-open Chromium fullscreen at boot"
echo "  4. sudo reboot                           # verify everything starts on its own"
echo
echo "Logs:        journalctl -u gpa-sidekick -f"
echo "Open in browser to test now: http://127.0.0.1:5000"
