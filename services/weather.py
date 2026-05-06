"""Fetches current conditions and a 7-day forecast from Open-Meteo (no API key)."""
import logging
from datetime import datetime
from threading import Lock

import requests

log = logging.getLogger(__name__)

# WMO weather code -> (emoji, label). https://open-meteo.com/en/docs
WEATHER_CODES = {
    0: ("☀️", "Clear"),
    1: ("\U0001f324️", "Mostly Clear"),
    2: ("⛅", "Partly Cloudy"),
    3: ("☁️", "Cloudy"),
    45: ("\U0001f32b️", "Fog"),
    48: ("\U0001f32b️", "Freezing Fog"),
    51: ("\U0001f326️", "Light Drizzle"),
    53: ("\U0001f326️", "Drizzle"),
    55: ("\U0001f326️", "Heavy Drizzle"),
    56: ("\U0001f9ca", "Freezing Drizzle"),
    57: ("\U0001f9ca", "Heavy Freezing Drizzle"),
    61: ("\U0001f327️", "Light Rain"),
    63: ("\U0001f327️", "Rain"),
    65: ("\U0001f327️", "Heavy Rain"),
    66: ("\U0001f9ca", "Freezing Rain"),
    67: ("\U0001f9ca", "Heavy Freezing Rain"),
    71: ("\U0001f328️", "Light Snow"),
    73: ("\U0001f328️", "Snow"),
    75: ("\U0001f328️", "Heavy Snow"),
    77: ("❄️", "Snow Grains"),
    80: ("\U0001f326️", "Light Showers"),
    81: ("\U0001f326️", "Showers"),
    82: ("\U0001f327️", "Heavy Showers"),
    85: ("\U0001f328️", "Snow Showers"),
    86: ("\U0001f328️", "Heavy Snow Showers"),
    95: ("⛈️", "Thunderstorm"),
    96: ("⛈️", "Thunderstorm w/ Hail"),
    99: ("⛈️", "Severe Thunderstorm"),
}


class WeatherService:
    def __init__(self, lat, lon, tz: str = "America/New_York"):
        self.lat = lat
        self.lon = lon
        self.tz = tz
        self._data = None
        self._lock = Lock()
        self._last_refresh: datetime | None = None

    def refresh(self):
        if self.lat is None or self.lon is None:
            log.warning("Weather lat/lon not configured.")
            return

        log.info("Fetching weather...")
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": self.lat,
            "longitude": self.lon,
            "current": "temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,apparent_temperature",
            "daily": "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "timezone": self.tz,
            "forecast_days": 7,
        }
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()

        cur = data.get("current", {}) or {}
        cur_code = cur.get("weather_code", 0)
        cur_emoji, cur_label = WEATHER_CODES.get(cur_code, ("\U0001f321️", "Unknown"))

        daily = data.get("daily", {}) or {}
        days = []
        times = daily.get("time", []) or []
        for i, d in enumerate(times):
            code = (daily.get("weather_code", []) or [None])[i]
            emoji, label = WEATHER_CODES.get(code, ("\U0001f321️", "Unknown"))
            days.append(
                {
                    "date": d,
                    "high": round((daily.get("temperature_2m_max", []) or [0])[i]),
                    "low": round((daily.get("temperature_2m_min", []) or [0])[i]),
                    "emoji": emoji,
                    "label": label,
                    "precip_chance": (
                        daily.get("precipitation_probability_max", []) or [None]
                    )[i],
                }
            )

        # Annotate superlatives across the 7-day window.
        if days:
            hottest = max(range(len(days)), key=lambda i: days[i]["high"])
            coldest = min(range(len(days)), key=lambda i: days[i]["low"])
            wettest = max(
                range(len(days)),
                key=lambda i: days[i].get("precip_chance") or -1,
            )
            wettest_chance = days[wettest].get("precip_chance") or 0
            for i, d in enumerate(days):
                d["superlative"] = None
            days[hottest]["superlative"] = "Hottest"
            days[coldest]["superlative"] = "Coldest"
            # Only call out a "rainiest" day if it's actually wet (>= 40%).
            if wettest_chance >= 40 and wettest not in (hottest, coldest):
                days[wettest]["superlative"] = "Rainiest"
            # Snow chance? Open-Meteo doesn't expose snow probability separately;
            # if any forecast day has a snow weather code, flag the first one.
            SNOW_CODES = {71, 73, 75, 77, 85, 86}
            for i, d in enumerate(days):
                code = (daily.get("weather_code", []) or [None])[i]
                if code in SNOW_CODES and not d["superlative"]:
                    d["superlative"] = "Snow!"
                    break

        result = {
            "current": {
                "temp": round(cur.get("temperature_2m", 0)),
                "feels_like": round(cur.get("apparent_temperature", cur.get("temperature_2m", 0))),
                "humidity": cur.get("relative_humidity_2m"),
                "wind": round(cur.get("wind_speed_10m", 0) or 0),
                "emoji": cur_emoji,
                "label": cur_label,
            },
            "daily": days,
        }
        with self._lock:
            self._data = result
            self._last_refresh = datetime.now()
        log.info(
            "Weather: %s°F %s",
            result["current"]["temp"],
            result["current"]["label"],
        )

    def get(self):
        with self._lock:
            return {
                "data": self._data,
                "last_refresh": self._last_refresh.isoformat()
                if self._last_refresh
                else None,
            }
