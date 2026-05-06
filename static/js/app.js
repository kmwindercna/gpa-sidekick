// Grandpa's Sidekick — frontend controller
const REFRESH_MS = 5 * 60 * 1000;        // refetch every 5 min
const NEWS_ROTATE_MS = 12 * 1000;        // rotate news every 12 sec
const CLOCK_MS = 1000;

let news = [];
let newsIdx = 0;

const pad = n => (n < 10 ? "0" + n : "" + n);
const DAY_NAMES_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_NAMES_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const m = pad(now.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  document.getElementById("clock").textContent = `${h}:${m} ${ampm}`;
  document.getElementById("date").textContent =
    `${DAY_NAMES_LONG[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;
}

function fmtEventTime(iso, allDay) {
  if (allDay) return "All Day";
  const d = new Date(iso);
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function localDayKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${DAY_NAMES_SHORT[d.getDay()]}, ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`;
}

async function loadCalendar() {
  try {
    const [calRes, holRes] = await Promise.all([
      fetch("/api/calendar").then(r => r.json()),
      fetch("/api/holidays").then(r => r.json()),
    ]);

    const items = [];
    for (const e of calRes.events || []) {
      items.push({
        type: "event",
        summary: e.summary,
        start: e.start,
        all_day: e.all_day,
      });
    }
    for (const h of (holRes.upcoming || [])) {
      items.push({
        type: "holiday",
        summary: h.name,
        start: h.date + "T00:00:00",
        all_day: true,
      });
    }
    items.sort((a, b) => a.start.localeCompare(b.start));

    const list = document.getElementById("event-list");
    list.innerHTML = "";

    let currentDayKey = null;
    let shown = 0;
    const MAX = 9;
    const todayKey = localDayKey(new Date());

    for (const item of items) {
      if (shown >= MAX) break;
      const d = new Date(item.start);
      const dKey = localDayKey(d);

      if (dKey !== currentDayKey) {
        const div = document.createElement("div");
        div.className = "day-divider";
        if (dKey === todayKey) div.classList.add("today");
        div.textContent = dayLabel(item.start);
        list.appendChild(div);
        currentDayKey = dKey;
      }

      const ev = document.createElement("div");
      ev.className = "event";
      if (item.type === "holiday") ev.classList.add("holiday");

      const time = document.createElement("div");
      time.className = "event-time";
      time.textContent =
        item.type === "holiday" ? "Holiday" : fmtEventTime(item.start, item.all_day);

      const sum = document.createElement("div");
      sum.className = "event-summary";
      sum.textContent = item.summary;

      ev.appendChild(time);
      ev.appendChild(sum);
      list.appendChild(ev);
      shown++;
    }

    if (shown === 0) {
      const empty = document.createElement("div");
      empty.className = "event empty";
      empty.textContent = "Nothing scheduled — enjoy your day!";
      list.appendChild(empty);
    }
  } catch (e) {
    console.error("calendar load failed", e);
  }
}

async function loadNews() {
  try {
    const res = await fetch("/api/news").then(r => r.json());
    news = res.items || [];
    if (newsIdx >= news.length) newsIdx = 0;
    renderNews();
  } catch (e) {
    console.error("news load failed", e);
  }
}

function renderNews() {
  const titleEl = document.getElementById("news-title");
  const sourceEl = document.getElementById("news-source");
  const imgEl = document.getElementById("news-image");
  const dots = document.getElementById("news-dots");

  if (!news.length) {
    titleEl.textContent = "No news available";
    sourceEl.textContent = "";
    imgEl.style.backgroundImage = "";
    imgEl.classList.add("no-image");
    dots.innerHTML = "";
    return;
  }

  const item = news[newsIdx % news.length];
  sourceEl.textContent = item.source || "";
  titleEl.textContent = item.title || "";
  if (item.image) {
    imgEl.style.backgroundImage = `url('${item.image.replace(/'/g, "\\'")}')`;
    imgEl.classList.remove("no-image");
  } else {
    imgEl.style.backgroundImage = "";
    imgEl.classList.add("no-image");
  }

  dots.innerHTML = "";
  const total = Math.min(news.length, 8);
  const activeIdx = newsIdx % total;
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    dot.className = "dot" + (i === activeIdx ? " active" : "");
    dots.appendChild(dot);
  }
}

function rotateNews() {
  if (!news.length) return;
  newsIdx = (newsIdx + 1) % news.length;
  renderNews();
}

async function loadWeather() {
  try {
    const res = await fetch("/api/weather").then(r => r.json());
    const data = res.data;
    if (!data) return;
    document.getElementById("cur-temp").textContent = `${data.current.temp}°`;
    document.getElementById("cur-emoji").textContent = data.current.emoji;
    const labelEl = document.getElementById("cur-label");
    if (labelEl && labelEl.textContent.trim() === "") {
      labelEl.textContent = data.current.label;
    }

    const daysEl = document.getElementById("forecast-days");
    daysEl.innerHTML = "";
    (data.daily || []).forEach((d, i) => {
      const dt = new Date(d.date + "T12:00:00");
      const fd = document.createElement("div");
      fd.className = "fday";
      const name = i === 0 ? "Today" : DAY_NAMES_SHORT[dt.getDay()];
      fd.innerHTML = `
        <div class="fday-name">${name}</div>
        <div class="fday-emoji">${d.emoji}</div>
        <div class="fday-temps"><span class="fday-high">${d.high}°</span><span class="fday-low">${d.low}°</span></div>
      `;
      daysEl.appendChild(fd);
    });
  } catch (e) {
    console.error("weather load failed", e);
  }
}

async function loadAll() {
  await Promise.all([loadCalendar(), loadNews(), loadWeather(), loadTheme()]);
  document.getElementById("status-bar").textContent =
    `Updated ${new Date().toLocaleTimeString()}` +
    (currentThemeName ? ` · ${currentThemeName}` : "");
}

let currentThemeName = "";
async function loadTheme() {
  try {
    const t = await fetch("/api/theme").then(r => r.json());
    currentThemeName = t.name || "";
  } catch (e) { /* ignore */ }
}

// --- Bootstrap ---
loadAll();
setInterval(loadAll, REFRESH_MS);

updateClock();
setInterval(updateClock, CLOCK_MS);

setInterval(rotateNews, NEWS_ROTATE_MS);

// Tap news panel to advance manually (touch-friendly)
document.getElementById("news-panel").addEventListener("click", rotateNews);

// Auto-reload page once an hour as a self-heal in case JS state goes stale
setTimeout(() => location.reload(), 60 * 60 * 1000);
