"""Birthdays loaded from config — surfaced as upcoming entries and as a today-is celebration."""
from datetime import date, timedelta


class BirthdaysService:
    def __init__(self, birthdays: list[dict]):
        self._raw = []
        for b in birthdays or []:
            d = (b.get("date") or "").strip()
            name = (b.get("name") or "").strip()
            if not d or not name or "MM" in d:
                continue
            try:
                month, day = [int(x) for x in d.split("-", 1)]
                self._raw.append({"month": month, "day": day, "name": name})
            except ValueError:
                continue

    def refresh(self):
        # Static — no network refresh needed.
        pass

    def get(self):
        today = date.today()
        end = today + timedelta(days=14)
        upcoming = []
        is_today = []
        d = today
        while d <= end:
            for b in self._raw:
                if b["month"] == d.month and b["day"] == d.day:
                    entry = {"date": d.isoformat(), "name": b["name"]}
                    upcoming.append(entry)
                    if d == today:
                        is_today.append(entry)
            d += timedelta(days=1)
        return {"upcoming": upcoming, "today": is_today}
