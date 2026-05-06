"""Daily wisdom — one line per day, deterministic by date."""
import datetime
import random

QUOTES = [
    ("It ain't over till it's over.", "Yogi Berra"),
    ("When you come to a fork in the road, take it.", "Yogi Berra"),
    ("Even if you're on the right track, you'll get run over if you just sit there.", "Will Rogers"),
    ("Don't let yesterday take up too much of today.", "Will Rogers"),
    ("If you find yourself in a hole, stop digging.", "Will Rogers"),
    ("Common sense ain't common.", "Will Rogers"),
    ("I never met a man I didn't like.", "Will Rogers"),
    ("The best way to cheer yourself up is to try to cheer somebody else up.", "Mark Twain"),
    ("Always do right. This will gratify some people and astonish the rest.", "Mark Twain"),
    ("Worrying is like paying a debt you don't owe.", "Mark Twain"),
    ("I can live for two months on a good compliment.", "Mark Twain"),
    ("Yesterday is history, tomorrow is a mystery, today is a gift.", "Eleanor Roosevelt"),
    ("It's never too late to be what you might have been.", "George Eliot"),
    ("Be kind whenever possible. It is always possible.", "Dalai Lama"),
    ("Family is not an important thing — it's everything.", "Michael J. Fox"),
    ("A grandfather is someone with silver in his hair and gold in his heart.", "Anonymous"),
    ("Slow and steady wins the race.", "Aesop"),
    ("Don't count the days, make the days count.", "Muhammad Ali"),
    ("The grand essentials in life are something to do, something to love, and something to hope for.", "Joseph Addison"),
    ("A bad day fishing beats a good day working.", "Anonymous"),
    ("It's the little things in life that mean the most.", "Anonymous"),
    ("Old friends are the best friends.", "Anonymous"),
    ("Today is a good day to have a good day.", "Anonymous"),
    ("The road to a friend's house is never long.", "Danish Proverb"),
    ("It's not the years in your life, it's the life in your years.", "Abraham Lincoln"),
    ("Patience is a tree whose root is bitter, but its fruit is very sweet.", "Persian Proverb"),
    ("A smooth sea never made a skilled sailor.", "Franklin D. Roosevelt"),
    ("The early bird gets the worm.", "Proverb"),
    ("Measure twice, cut once.", "Proverb"),
    ("Don't worry about the world coming to an end today. It's already tomorrow in Australia.", "Charles Schulz"),
]


class QuotesService:
    def refresh(self):
        pass

    def get(self):
        today = datetime.date.today()
        seed = today.year * 10000 + today.month * 100 + today.day
        text, author = random.Random(seed).choice(QUOTES)
        return {"text": text, "author": author, "date": today.isoformat()}
