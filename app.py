"""Grandpa's Sidekick — local Flask dashboard for a Raspberry Pi touchscreen."""
import json
import logging
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template

from services.calendar_svc import CalendarService
from services.news import NewsService
from services.holidays_svc import HolidaysService
from services.weather import WeatherService
from services.themes import pick_theme
from services.birthdays import BirthdaysService
from services.quotes import QuotesService
from services.onthisday import OnThisDayService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("gpa-sidekick")

CONFIG_PATH = Path(__file__).parent / "config.json"
if not CONFIG_PATH.exists():
    raise SystemExit(
        f"Missing {CONFIG_PATH} — copy config.example.json to config.json and fill it in."
    )

with open(CONFIG_PATH) as f:
    config = json.load(f)

app = Flask(__name__)
APP_START_TS = time.time()

calendar_svc = CalendarService(config.get("calendar_ical_url", ""))
news_svc = NewsService(config.get("news_feeds", []))
holidays_svc = HolidaysService(
    config.get("holiday_country", "US"),
    config.get("holiday_subdiv"),
)
weather_cfg = config.get("weather", {})
weather_svc = WeatherService(
    weather_cfg.get("latitude"),
    weather_cfg.get("longitude"),
    weather_cfg.get("timezone", "America/New_York"),
)
birthdays_svc = BirthdaysService(config.get("birthdays", []))
quotes_svc = QuotesService()
onthisday_svc = OnThisDayService()


def refresh_loop():
    """Periodically refresh all services in the background."""
    while True:
        for name, svc in (
            ("calendar", calendar_svc),
            ("news", news_svc),
            ("weather", weather_svc),
            ("onthisday", onthisday_svc),
        ):
            try:
                svc.refresh()
            except Exception as e:
                log.warning("%s refresh failed: %s", name, e)
        time.sleep(config.get("refresh_seconds", 600))


threading.Thread(target=refresh_loop, daemon=True).start()


@app.route("/")
def index():
    return render_template(
        "index.html",
        config=config,
        theme=pick_theme(),
        names=config.get("names") or ["Friend"],
        about_note=config.get(
            "about_note",
            "Hi Grandpa! Hope you're having a great day. — Love, Kyle ❤️",
        ),
    )


@app.route("/api/calendar")
def api_calendar():
    return jsonify(calendar_svc.get())


@app.route("/api/news")
def api_news():
    return jsonify(news_svc.get())


@app.route("/api/holidays")
def api_holidays():
    return jsonify(holidays_svc.get())


@app.route("/api/weather")
def api_weather():
    return jsonify(weather_svc.get())


@app.route("/api/theme")
def api_theme():
    return jsonify(pick_theme())


@app.route("/api/birthdays")
def api_birthdays():
    return jsonify(birthdays_svc.get())


@app.route("/api/quote")
def api_quote():
    return jsonify(quotes_svc.get())


@app.route("/api/onthisday")
def api_onthisday():
    return jsonify(onthisday_svc.get())


@app.route("/api/system")
def api_system():
    """Used by the secret tap menu."""
    uptime_seconds = int(time.time() - APP_START_TS)
    return jsonify(
        {
            "uptime_seconds": uptime_seconds,
            "started_at": datetime.fromtimestamp(APP_START_TS).isoformat(),
            "now": datetime.now().isoformat(),
            "weather_label": weather_cfg.get("label", ""),
            "theme": pick_theme()["name"],
        }
    )


@app.route("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    host = config.get("host", "127.0.0.1")
    port = int(config.get("port", 5000))
    log.info("Starting Grandpa's Sidekick on http://%s:%d", host, port)
    app.run(host=host, port=port, threaded=True, debug=False)
