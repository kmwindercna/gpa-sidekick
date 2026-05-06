"""Color themes for the dashboard. A different theme is picked each ISO week,
seeded by the year+week so it's stable Monday→Sunday but varies week to week."""
import datetime
import random

THEMES = [
    {
        "name": "Midnight",
        "bg": "#0b0e16", "surface": "#131826", "border": "#1f2937",
        "text": "#f1f5f9", "muted": "#94a3b8", "subtle": "#cbd5e1",
        "accent": "#fbbf24", "warm": "#f87171", "cool": "#60a5fa",
        "good": "#a7f3d0", "good_strong": "#34d399",
    },
    {
        "name": "Forest",
        "bg": "#0c1410", "surface": "#1a2520", "border": "#2d3a32",
        "text": "#e8efe6", "muted": "#8da895", "subtle": "#b8cfbf",
        "accent": "#f4cf6e", "warm": "#e88560", "cool": "#7fb1d4",
        "good": "#a3d9a5", "good_strong": "#4caf6e",
    },
    {
        "name": "Ocean",
        "bg": "#0a1620", "surface": "#152835", "border": "#1f3a4a",
        "text": "#e6f0f5", "muted": "#7fa5b8", "subtle": "#b5cdd9",
        "accent": "#ff9b7a", "warm": "#ff7e6b", "cool": "#5dc7e8",
        "good": "#9fdce0", "good_strong": "#3fbcc6",
    },
    {
        "name": "Sunset",
        "bg": "#1a0f1a", "surface": "#2a1a2c", "border": "#3d2a40",
        "text": "#f5ecf0", "muted": "#b89bb0", "subtle": "#d4bfcb",
        "accent": "#ffb47e", "warm": "#ff8a73", "cool": "#a78bfa",
        "good": "#fbc4ab", "good_strong": "#f08c70",
    },
    {
        "name": "Coffee",
        "bg": "#15100c", "surface": "#241a14", "border": "#3a2a20",
        "text": "#f0e8de", "muted": "#a89281", "subtle": "#c9b8a4",
        "accent": "#e6b87a", "warm": "#d97757", "cool": "#a3c4d4",
        "good": "#bfd9b8", "good_strong": "#8bbf72",
    },
    {
        "name": "Wine",
        "bg": "#180b10", "surface": "#28141d", "border": "#3d2030",
        "text": "#f5e8ed", "muted": "#b08899", "subtle": "#cfb0bd",
        "accent": "#f5c66c", "warm": "#e87060", "cool": "#9eb8d9",
        "good": "#c5d99e", "good_strong": "#9cbf6f",
    },
    {
        "name": "Storm",
        "bg": "#0d1117", "surface": "#161b25", "border": "#252e3a",
        "text": "#edf0f5", "muted": "#8a95a8", "subtle": "#bcc5d4",
        "accent": "#5dade2", "warm": "#ec7063", "cool": "#3498db",
        "good": "#a3e4d7", "good_strong": "#48c9b0",
    },
    {
        "name": "Plum",
        "bg": "#140c1f", "surface": "#241830", "border": "#3a2848",
        "text": "#f0eaf5", "muted": "#a890bd", "subtle": "#cab8d9",
        "accent": "#ffc1cc", "warm": "#ff8fa3", "cool": "#b794f6",
        "good": "#c5e4d0", "good_strong": "#7fc89c",
    },
    {
        "name": "Pine",
        "bg": "#0a1614", "surface": "#142624", "border": "#1f3a37",
        "text": "#e8f0ee", "muted": "#85a8a3", "subtle": "#b5cdc9",
        "accent": "#f4c87c", "warm": "#e87b6e", "cool": "#7fc4d9",
        "good": "#a8d9b5", "good_strong": "#5cb87a",
    },
    {
        "name": "Pumpkin",
        "bg": "#15100a", "surface": "#241b10", "border": "#3d2a18",
        "text": "#f5ece0", "muted": "#b09680", "subtle": "#d4bfa8",
        "accent": "#ff9933", "warm": "#e8623d", "cool": "#a3c8d9",
        "good": "#cce0a3", "good_strong": "#8fbf5c",
    },
    {
        "name": "Mint",
        "bg": "#0a1614", "surface": "#152826", "border": "#203d39",
        "text": "#e8f5f0", "muted": "#80b0a3", "subtle": "#b8d9cd",
        "accent": "#fdd96e", "warm": "#ec8876", "cool": "#5cd9c0",
        "good": "#a8efd0", "good_strong": "#3dc4a3",
    },
    {
        "name": "Berry",
        "bg": "#160a14", "surface": "#281428", "border": "#3d2040",
        "text": "#f0e6f0", "muted": "#a890b0", "subtle": "#ccb8cc",
        "accent": "#ffe066", "warm": "#ff6b9d", "cool": "#b388eb",
        "good": "#c8e6c9", "good_strong": "#81c784",
    },
    {
        "name": "Steel",
        "bg": "#0e1218", "surface": "#1c2230", "border": "#2d3548",
        "text": "#eef1f7", "muted": "#8b95ad", "subtle": "#bcc4d4",
        "accent": "#ffe14d", "warm": "#ff7676", "cool": "#7eb8e8",
        "good": "#b8e3c8", "good_strong": "#5ec48e",
    },
    {
        "name": "Earth",
        "bg": "#13110a", "surface": "#221f12", "border": "#383320",
        "text": "#f0ebd9", "muted": "#a89c7a", "subtle": "#cabd9c",
        "accent": "#ffd966", "warm": "#d97a4d", "cool": "#5fb8c2",
        "good": "#c9e0a3", "good_strong": "#8fbf66",
    },
]


def pick_theme(now=None):
    """Pick a theme deterministically from the current ISO week."""
    today = now or datetime.date.today()
    iso = today.isocalendar()
    seed = iso[0] * 100 + iso[1]
    return random.Random(seed).choice(THEMES)
