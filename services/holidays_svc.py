"""Provides federal + state holidays via the `holidays` package."""
import logging
from datetime import date, timedelta

import holidays

log = logging.getLogger(__name__)


class HolidaysService:
    def __init__(self, country: str = "US", subdiv: str | None = None):
        self.country = country
        self.subdiv = subdiv
        try:
            if subdiv:
                self._hol = holidays.country_holidays(country, subdiv=subdiv)
            else:
                self._hol = holidays.country_holidays(country)
        except Exception as e:
            log.warning(
                "Failed to init holidays for %s/%s, falling back to US: %s",
                country, subdiv, e,
            )
            self._hol = holidays.country_holidays("US")

    def refresh(self):
        # Holidays are computed locally; no network needed.
        pass

    def get(self):
        today = date.today()
        end = today + timedelta(days=60)
        upcoming = []
        d = today
        while d <= end:
            if d in self._hol:
                upcoming.append({"date": d.isoformat(), "name": self._hol[d]})
            d += timedelta(days=1)
        return {"upcoming": upcoming}
