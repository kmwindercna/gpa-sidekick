"""Fetches a notable historical event for today's date from Wikipedia's free API."""
import logging
import random
from datetime import date, datetime
from threading import Lock

import requests

log = logging.getLogger(__name__)

USER_AGENT = "gpa-sidekick/1.0 (https://github.com/local) Contact: local"


class OnThisDayService:
    def __init__(self):
        self._event: dict | None = None
        self._cache_date: date | None = None
        self._lock = Lock()
        self._last_refresh: datetime | None = None

    def refresh(self):
        today = date.today()
        with self._lock:
            if self._cache_date == today and self._event:
                return  # already cached for today

        url = (
            "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/"
            f"{today.month:02d}/{today.day:02d}"
        )
        log.info("Fetching On This Day for %s", today.isoformat())
        try:
            r = requests.get(url, timeout=15, headers={"User-Agent": USER_AGENT})
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            log.warning("On This Day fetch failed: %s", e)
            return

        events = data.get("events") or []
        if not events:
            return

        # Prefer events with images; deterministic per day.
        seed = today.year * 10000 + today.month * 100 + today.day
        rng = random.Random(seed)
        candidates = events[:25]
        # Score: prefer entries that have a thumbnail image
        with_image = [e for e in candidates if self._first_image(e)]
        chosen = rng.choice(with_image) if with_image else rng.choice(candidates)

        text = (chosen.get("text") or "").strip()
        year = chosen.get("year")
        image = self._first_image(chosen)
        link = self._first_link(chosen)

        with self._lock:
            self._event = {
                "year": year,
                "text": text,
                "image": image,
                "link": link,
            }
            self._cache_date = today
            self._last_refresh = datetime.now()
        log.info("On This Day (%s): %s", year, text[:80])

    @staticmethod
    def _first_image(event):
        for p in event.get("pages", []) or []:
            thumb = (p.get("thumbnail") or {}).get("source")
            if thumb:
                return thumb
            orig = (p.get("originalimage") or {}).get("source")
            if orig:
                return orig
        return None

    @staticmethod
    def _first_link(event):
        for p in event.get("pages", []) or []:
            urls = (p.get("content_urls") or {}).get("desktop") or {}
            if urls.get("page"):
                return urls["page"]
        return None

    def get(self):
        with self._lock:
            return {
                "event": self._event,
                "last_refresh": self._last_refresh.isoformat() if self._last_refresh else None,
            }
