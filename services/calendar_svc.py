"""Fetches and parses a Google Calendar private iCal feed, expanding recurring events."""
import logging
from datetime import datetime, timedelta, timezone
from threading import Lock

import requests
import recurring_ical_events
from icalendar import Calendar

log = logging.getLogger(__name__)


class CalendarService:
    def __init__(self, ical_url: str):
        self.ical_url = (ical_url or "").strip()
        self._events: list[dict] = []
        self._lock = Lock()
        self._last_refresh: datetime | None = None

    def refresh(self):
        if not self.ical_url or "PASTE" in self.ical_url:
            log.warning("Calendar iCal URL not configured — skipping fetch.")
            return

        log.info("Fetching calendar...")
        r = requests.get(self.ical_url, timeout=15)
        r.raise_for_status()
        cal = Calendar.from_ical(r.content)

        now = datetime.now(timezone.utc)
        start_window = now - timedelta(hours=12)
        end_window = now + timedelta(days=14)

        events = []
        for ev in recurring_ical_events.of(cal).between(start_window, end_window):
            dtstart = ev.get("dtstart").dt
            summary = str(ev.get("summary", "")).strip()
            location = str(ev.get("location", "")).strip()

            if isinstance(dtstart, datetime):
                if dtstart.tzinfo:
                    start = dtstart.astimezone(timezone.utc)
                else:
                    start = dtstart.replace(tzinfo=timezone.utc)
                all_day = False
            else:
                start = datetime(
                    dtstart.year, dtstart.month, dtstart.day, tzinfo=timezone.utc
                )
                all_day = True

            events.append(
                {
                    "summary": summary or "(no title)",
                    "location": location,
                    "start": start.isoformat(),
                    "all_day": all_day,
                }
            )

        events.sort(key=lambda e: e["start"])
        with self._lock:
            self._events = events
            self._last_refresh = datetime.now()
        log.info("Calendar: %d events in window", len(events))

    def get(self):
        with self._lock:
            return {
                "events": list(self._events),
                "last_refresh": self._last_refresh.isoformat()
                if self._last_refresh
                else None,
            }
