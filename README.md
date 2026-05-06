# Grandpa's Sidekick

A simple, reliable touchscreen dashboard for a Raspberry Pi running Raspberry Pi OS.
Built as a replacement for MagicMirror — one Python process, one config file, no
flaky Node modules.

**Designed for the official 7" Pi touchscreen (800×480).**

Shows:
- Big clock + date
- Current weather + 7-day forecast (Loganville, GA out of the box)
- Today's & upcoming Google Calendar events (read-only via private iCal URL)
- US + Georgia state holidays
- Rotating news headlines with images (Fox 5 Atlanta, Fox News, Atlanta News First)

Auto-restarts on crash. Auto-launches Chromium kiosk-mode at boot. Survives reboots
without intervention.

---

## One-time setup (on the Pi)

### 1. Clone the repo onto the Pi

```bash
cd ~
git clone <your-repo-url> gpa-sidekick
cd gpa-sidekick
```

### 2. Run the installer

```bash
./scripts/install.sh
```

This will:
- Install system packages (`python3-venv`, `chromium`, `unclutter`, `curl`)
- Create a Python virtualenv and install dependencies
- Copy `config.example.json` → `config.json`
- Install and start the **gpa-sidekick** systemd service (auto-restart on crash, auto-start on boot)

### 3. Add the Google Calendar private iCal URL

In Google Calendar, on a desktop:
1. Settings → click the calendar in the left sidebar
2. Scroll to **Integrate calendar**
3. Copy the **Secret address in iCal format**

Then edit `config.json` and paste it into `calendar_ical_url`:

```bash
nano ~/gpa-sidekick/config.json
sudo systemctl restart gpa-sidekick
```

### 4. Test it in a browser on the Pi

Open Chromium and visit `http://127.0.0.1:5000` — you should see the dashboard.

### 5. Set up Chromium kiosk autostart

```bash
./scripts/setup-kiosk.sh
sudo reboot
```

After the reboot, the Pi will boot directly into the dashboard fullscreen. No
mouse, no taskbar, no fuss.

---

## Configuration

Everything is in `config.json`. The example file documents the shape:

```json
{
  "host": "127.0.0.1",
  "port": 5000,
  "refresh_seconds": 600,
  "calendar_ical_url": "<paste here>",
  "news_feeds": [
    { "name": "Fox 5 Atlanta",      "url": "https://www.fox5atlanta.com/rss" },
    { "name": "Fox News",           "url": "https://moxie.foxnews.com/google-publisher/latest.xml" },
    { "name": "Atlanta News First", "url": "https://www.atlantanewsfirst.com/arc/outboundfeeds/rss/?outputType=xml" }
  ],
  "holiday_country": "US",
  "holiday_subdiv":  "GA",
  "weather": {
    "label":     "Loganville, GA",
    "latitude":  33.8388,
    "longitude": -83.9013,
    "timezone":  "America/New_York"
  },

  "names": ["Grandpa", "Grumpy"],

  "birthdays": [
    { "date": "06-12", "name": "Granddaughter Susie" },
    { "date": "11-04", "name": "Grumpy" }
  ],

  "about_note": "Hi Grandpa! Hope you're having a great day. — Love, Kyle ❤️"
}
```

After editing, restart the service:

```bash
sudo systemctl restart gpa-sidekick
```

### Easter eggs (configurable)

| Field | What it does |
|---|---|
| `names` | Array of nicknames. The header greeting (*"Good morning, Grumpy"*) randomly picks one each minute, rotating phrase by time of day. |
| `birthdays` | Array of `{ "date": "MM-DD", "name": "..." }`. Birthdays show up in the calendar list with 🎂, and on the actual day a celebration card cycles into the news rotation + confetti rains across the screen. Add as many as you like. |
| `about_note` | The personal message shown when the clock is tapped 5 times in a row (the secret tap menu). |

### Built-in seasonal flair (no config needed)

- ❄️ **Snowflakes fall** through December
- 🍂 **Leaves drift** in October
- 💕 **Hearts rise** on February 14
- 🎆 **Fireworks burst** on July 4
- 🎉 **Confetti** on any configured birthday

### Other always-on touches

- **Weekly color theme** — picks one of 14 palettes per ISO week, deterministic so it's stable Monday → Sunday but new every week. Theme name is shown faintly in the bottom-right corner.
- **Daily wisdom** — a folksy quote (Mark Twain, Will Rogers, Yogi Berra, etc.) appears between the dashboard and the forecast strip; rotates daily.
- **On This Day in history** — Wikipedia's "on this day" picks one notable event for today's date, mixed into the news rotation with its own image.
- **Weather superlatives** — the 7-day forecast labels the *Hottest*, *Coldest*, *Rainiest*, and any *Snow!* day with a small badge.
- **Personal greeting** — *"Good morning, Grandpa"* / *"Good afternoon, Grumpy"* / etc., name picked at random from `config.names`.

### The secret tap menu

Tap the clock **5 times in 3 seconds**. A full-screen card opens showing your `about_note`, the active theme, the configured weather location, how long the dashboard has been running, and when it last started. Tap anywhere to dismiss.

### Adjusting RSS feeds

If a news source stops working, swap the URL in `news_feeds`. Bad feeds are
logged but won't crash the app — the dashboard just shows fewer items.

### Changing weather location

Look up lat/lon for any address (Google Maps right-click → coordinates) and
update the `weather` section.

---

## Day-to-day operation

| What | How |
|---|---|
| **View logs** | `journalctl -u gpa-sidekick -f` |
| **Restart the app** | `sudo systemctl restart gpa-sidekick` |
| **Stop / disable** | `sudo systemctl stop gpa-sidekick` / `disable` |
| **Update code** | `cd ~/gpa-sidekick && git pull && sudo systemctl restart gpa-sidekick` |
| **Exit kiosk mode** (if you need a normal desktop) | `Ctrl + Alt + F2` to switch TTY, or `pkill chromium` over SSH |

The systemd service has `Restart=always` with a 5-second backoff, so the app
recovers automatically from crashes, network outages, or transient errors.

---

## Architecture

```
gpa-sidekick/
├── app.py                   # Flask server + background refresh loop
├── config.json              # All user settings (gitignored)
├── services/
│   ├── calendar_svc.py      # Google Calendar iCal + RRULE expansion
│   ├── news.py              # RSS fetch + image extraction
│   ├── holidays_svc.py      # US + GA holidays via `holidays` package
│   └── weather.py           # Open-Meteo (no API key required)
├── templates/index.html     # Single-page dashboard
├── static/css/style.css     # 800x480 layout
├── static/js/app.js         # Frontend controller, polls /api/* every 5 min
└── scripts/
    ├── install.sh           # apt + venv + systemd service
    └── setup-kiosk.sh       # Chromium kiosk autostart (Wayland or X11)
```

The Flask app binds to `127.0.0.1` only — nothing is exposed to the network.
News and calendar data are fetched in a background thread every 10 minutes
(configurable via `refresh_seconds`).

---

## Troubleshooting

**Dashboard loads but calendar is empty:**
Check the iCal URL — open it in a browser, you should see raw `BEGIN:VCALENDAR`
text. If it 404s or asks for login, regenerate it in Google Calendar settings.
Logs: `journalctl -u gpa-sidekick -f`.

**News images don't show for one source:**
Some feeds don't include images. The dashboard still shows the headline. To
verify, hit `http://127.0.0.1:5000/api/news` in a browser and look at the
`image` field for that source.

**Screen goes black after a few minutes:**
Run `sudo raspi-config` → *Display Options* → *Screen Blanking* → *Disable*.
The kiosk script tries to do this automatically.

**Chromium doesn't start at boot:**
The autostart location depends on your PiOS version. On Bookworm with Pi 4/5
the file is `~/.config/labwc/autostart`. On older versions with LXDE it's
`~/.config/lxsession/LXDE-pi/autostart`. Re-run `./scripts/setup-kiosk.sh` —
it auto-detects.

**App crashes on startup:**
Check `journalctl -u gpa-sidekick -n 50` for the traceback. Most common cause:
malformed `config.json` (missing comma, etc.). Validate with `python3 -m
json.tool config.json`.
