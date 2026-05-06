#!/usr/bin/env bash
# Grandpa's Sidekick — kiosk autostart setup.
# Configures Chromium to open the dashboard fullscreen on every boot.
# Run as the desktop user (NOT with sudo).
set -euo pipefail

if [ "$EUID" -eq 0 ]; then
  echo "Run this WITHOUT sudo (as the desktop user, e.g. pi)."
  exit 1
fi

URL="http://127.0.0.1:5000"

if command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
  CHROMIUM=chromium
else
  echo "ERROR: Chromium not installed. Run scripts/install.sh first."
  exit 1
fi

mkdir -p "$HOME/bin"
LAUNCHER="$HOME/bin/gpa-sidekick-kiosk.sh"
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
# Wait until the Flask app is responding before launching Chromium.
for i in \$(seq 1 60); do
  if curl -fsS "$URL/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done

# Kill any existing chromium kiosk windows (idempotent restarts).
pkill -f "chromium.*--kiosk" 2>/dev/null || true

# Disable screen blanking on X11 (no-op on Wayland).
xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

# Hide the cursor when idle.
unclutter -idle 0.1 -root >/dev/null 2>&1 &

CHROMIUM_FLAGS=(
  --kiosk
  --noerrdialogs
  --disable-infobars
  --no-first-run
  --start-fullscreen
  --window-size=1024,600
  --window-position=0,0
  --check-for-update-interval=31536000
  --disable-features=Translate,InfiniteSessionRestore
  --disable-pinch
  --overscroll-history-navigation=0
  --disable-session-crashed-bubble
  --disable-restore-session-state
  --autoplay-policy=no-user-gesture-required
  "$URL"
)

exec $CHROMIUM "\${CHROMIUM_FLAGS[@]}"
EOF
chmod +x "$LAUNCHER"
echo "==> Wrote launcher to $LAUNCHER"

SESSION="${XDG_SESSION_TYPE:-}"
DESKTOP="${XDG_CURRENT_DESKTOP:-}"
echo "==> Detected session: ${SESSION:-unknown} / ${DESKTOP:-unknown}"

INSTALLED=0

# --- Wayland: labwc (PiOS Bookworm default on Pi 4/5) ---
if [ -d "$HOME/.config/labwc" ] || [ "$SESSION" = "wayland" ]; then
  mkdir -p "$HOME/.config/labwc"
  AUTOSTART="$HOME/.config/labwc/autostart"
  touch "$AUTOSTART"
  if ! grep -q "gpa-sidekick-kiosk.sh" "$AUTOSTART"; then
    echo "$LAUNCHER &" >> "$AUTOSTART"
  fi
  echo "==> Added launcher to $AUTOSTART (labwc/wayland)"
  INSTALLED=1
fi

# --- Wayland: wayfire (older Bookworm) ---
if [ -f "$HOME/.config/wayfire.ini" ]; then
  if ! grep -q "gpa-sidekick" "$HOME/.config/wayfire.ini"; then
    cat >> "$HOME/.config/wayfire.ini" <<EOF

[autostart]
gpa_sidekick = $LAUNCHER
EOF
    echo "==> Appended autostart to $HOME/.config/wayfire.ini"
    INSTALLED=1
  fi
fi

# --- X11 / LXDE (Bullseye and older) ---
LXAUTO="$HOME/.config/lxsession/LXDE-pi/autostart"
if [ "$DESKTOP" = "LXDE" ] || [ -d /etc/xdg/lxsession/LXDE-pi ]; then
  mkdir -p "$(dirname "$LXAUTO")"
  if [ ! -f "$LXAUTO" ] && [ -f /etc/xdg/lxsession/LXDE-pi/autostart ]; then
    cp /etc/xdg/lxsession/LXDE-pi/autostart "$LXAUTO"
  fi
  touch "$LXAUTO"
  if ! grep -q "gpa-sidekick" "$LXAUTO"; then
    cat >> "$LXAUTO" <<EOF

@xset s off
@xset -dpms
@xset s noblank
@$LAUNCHER
EOF
    echo "==> Updated $LXAUTO (X11/LXDE)"
    INSTALLED=1
  fi
fi

if [ $INSTALLED -eq 0 ]; then
  echo "WARNING: Could not detect a known autostart location."
  echo "         Manually arrange for this command to run on login:"
  echo "           $LAUNCHER &"
fi

# Best-effort: disable screen blanking globally.
echo "==> Disabling screen blanking via raspi-config (sudo)"
sudo raspi-config nonint do_blanking 1 2>/dev/null || \
  echo "    (skipped — install raspi-config or disable blanking manually)"

echo
echo "==> Kiosk setup complete."
echo "    Reboot to verify everything starts automatically:"
echo "        sudo reboot"
