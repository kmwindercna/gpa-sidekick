"""Fetches RSS news feeds and extracts headline images for display."""
import logging
import re
from datetime import datetime
from threading import Lock

import feedparser
import requests

log = logging.getLogger(__name__)

USER_AGENT = "gpa-sidekick/1.0 (+local Raspberry Pi dashboard)"


class NewsService:
    def __init__(self, feeds: list[dict]):
        self.feeds = feeds or []
        self._items: list[dict] = []
        self._lock = Lock()
        self._last_refresh: datetime | None = None

    @staticmethod
    def _extract_image(entry) -> str | None:
        """Best-effort image URL extraction across the various RSS conventions."""
        media = entry.get("media_content")
        if media:
            for m in media:
                url = m.get("url")
                if url:
                    return url

        thumbs = entry.get("media_thumbnail")
        if thumbs:
            for m in thumbs:
                url = m.get("url")
                if url:
                    return url

        for enc in entry.get("enclosures", []) or []:
            t = enc.get("type", "") or ""
            href = enc.get("href")
            if href and t.startswith("image"):
                return href

        for field in ("summary", "content", "description"):
            val = entry.get(field)
            if isinstance(val, list) and val:
                val = val[0].get("value", "") if isinstance(val[0], dict) else str(val[0])
            if isinstance(val, str):
                m = re.search(r'<img[^>]+src="([^"]+)"', val)
                if m:
                    return m.group(1)
        return None

    def refresh(self):
        log.info("Fetching news...")
        all_items = []
        for feed in self.feeds:
            name = feed.get("name", "Unknown")
            url = feed.get("url")
            if not url:
                continue
            try:
                resp = requests.get(
                    url, timeout=15, headers={"User-Agent": USER_AGENT}
                )
                resp.raise_for_status()
                d = feedparser.parse(resp.content)
                count = 0
                for entry in d.entries[:10]:
                    pub_iso = None
                    pub = entry.get("published_parsed") or entry.get("updated_parsed")
                    if pub:
                        try:
                            pub_iso = datetime(*pub[:6]).isoformat()
                        except Exception:
                            pass
                    title = (entry.get("title") or "").strip()
                    if not title:
                        continue
                    all_items.append(
                        {
                            "source": name,
                            "title": title,
                            "link": entry.get("link", ""),
                            "image": self._extract_image(entry),
                            "published": pub_iso,
                        }
                    )
                    count += 1
                log.info("News: loaded %d items from %s", count, name)
            except Exception as e:
                log.warning("News fetch failed for %s (%s): %s", name, url, e)

        all_items.sort(key=lambda i: i.get("published") or "", reverse=True)
        with self._lock:
            self._items = all_items[:30]
            self._last_refresh = datetime.now()
        log.info("News: %d total items cached", len(self._items))

    def get(self):
        with self._lock:
            return {
                "items": list(self._items),
                "last_refresh": self._last_refresh.isoformat()
                if self._last_refresh
                else None,
            }
