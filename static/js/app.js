// Grandpa's Sidekick — frontend controller
const REFRESH_MS = 5 * 60 * 1000;        // refetch APIs every 5 min
const NEWS_ROTATE_MS = 12 * 1000;        // rotate news every 12 sec
const CLOCK_MS = 1000;
const GREETING_REROLL_MS = 60 * 1000;    // pick a new name every minute

const CFG = window.__GPS_CONFIG__ || {};
const NAMES = (CFG.names && CFG.names.length) ? CFG.names : ["Friend"];
const ABOUT_NOTE = CFG.aboutNote || "Hi from Kyle ❤️";

const pad = n => (n < 10 ? "0" + n : "" + n);
const DAY_NAMES_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_NAMES_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let newsItems = [];     // mix of regular news + on-this-day + birthday slides
let newsIdx = 0;
let currentThemeName = "";

// =====================================================================
// CLOCK + GREETING
// =====================================================================
function pickName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}
function timeOfDayPhrase(h) {
  if (h < 5)  return "Sleep well";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Sweet dreams";
}

let lastGreetingMinute = -1;
function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const m = pad(now.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  document.getElementById("clock").textContent = `${h12}:${m} ${ampm}`;
  document.getElementById("date").textContent =
    `${DAY_NAMES_LONG[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;

  // Refresh greeting periodically (random name + time-of-day phrase).
  if (now.getMinutes() !== lastGreetingMinute) {
    lastGreetingMinute = now.getMinutes();
    document.getElementById("greeting").textContent =
      `${timeOfDayPhrase(h)}, ${pickName()}`;
  }
}

// =====================================================================
// CALENDAR + HOLIDAYS + BIRTHDAYS (combined list)
// =====================================================================
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
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const d = new Date(date); d.setHours(0,0,0,0);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${DAY_NAMES_SHORT[d.getDay()]}, ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`;
}

let birthdaysToday = [];

async function loadCalendar() {
  try {
    const [calRes, holRes, bdRes] = await Promise.all([
      fetch("/api/calendar").then(r => r.json()),
      fetch("/api/holidays").then(r => r.json()),
      fetch("/api/birthdays").then(r => r.json()),
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
    for (const b of (bdRes.upcoming || [])) {
      items.push({
        type: "birthday",
        summary: `${b.name}'s Birthday`,
        start: b.date + "T00:00:00",
        all_day: true,
      });
    }
    items.sort((a, b) => a.start.localeCompare(b.start));

    birthdaysToday = bdRes.today || [];

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
      ev.className = `event ${item.type}`;
      const time = document.createElement("div");
      time.className = "event-time";
      time.textContent =
        item.type === "holiday"  ? "Holiday"  :
        item.type === "birthday" ? "Birthday" :
        fmtEventTime(item.start, item.all_day);
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

// =====================================================================
// NEWS (regular + On This Day + birthday celebration)
// =====================================================================
async function loadNews() {
  try {
    const [newsRes, otdRes] = await Promise.all([
      fetch("/api/news").then(r => r.json()),
      fetch("/api/onthisday").then(r => r.json()).catch(() => ({})),
    ]);
    const items = [];

    // Inject a birthday celebration slide (front of rotation) if today is one.
    for (const b of birthdaysToday) {
      items.push({
        kind: "birthday",
        source: "🎂 Today",
        title: `Happy Birthday, ${b.name}!`,
        image: null,
      });
    }

    // On This Day in history (if available).
    const otd = (otdRes && otdRes.event) || null;
    if (otd && otd.text) {
      items.push({
        kind: "otd",
        source: otd.year ? `On This Day · ${otd.year}` : "On This Day",
        title: otd.text,
        image: otd.image || null,
      });
    }

    // Regular news.
    for (const n of (newsRes.items || [])) {
      items.push({
        kind: "news",
        source: n.source,
        title: n.title,
        image: n.image,
      });
    }

    newsItems = items;
    if (newsIdx >= newsItems.length) newsIdx = 0;
    renderNews();
  } catch (e) {
    console.error("news load failed", e);
  }
}

function renderNews() {
  const titleEl  = document.getElementById("news-title");
  const sourceEl = document.getElementById("news-source");
  const imgEl    = document.getElementById("news-image");
  const dots     = document.getElementById("news-dots");
  const panel    = document.getElementById("news-panel");

  panel.classList.remove("news-mode-otd", "news-mode-birthday");

  if (!newsItems.length) {
    titleEl.textContent = "No news available";
    sourceEl.textContent = "";
    imgEl.style.backgroundImage = "";
    imgEl.classList.add("no-image");
    dots.innerHTML = "";
    return;
  }

  const item = newsItems[newsIdx % newsItems.length];
  if (item.kind === "otd") panel.classList.add("news-mode-otd");
  if (item.kind === "birthday") panel.classList.add("news-mode-birthday");

  sourceEl.textContent = item.source || "";
  titleEl.textContent  = item.title  || "";
  if (item.image) {
    imgEl.style.backgroundImage = `url('${item.image.replace(/'/g, "\\'")}')`;
    imgEl.classList.remove("no-image");
  } else {
    imgEl.style.backgroundImage = "";
    imgEl.classList.add("no-image");
  }

  dots.innerHTML = "";
  const total = Math.min(newsItems.length, 8);
  const activeIdx = newsIdx % total;
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    dot.className = "dot" + (i === activeIdx ? " active" : "");
    dots.appendChild(dot);
  }
}
function rotateNews() {
  if (!newsItems.length) return;
  newsIdx = (newsIdx + 1) % newsItems.length;
  renderNews();
}

// =====================================================================
// WEATHER + SUPERLATIVES
// =====================================================================
async function loadWeather() {
  try {
    const res = await fetch("/api/weather").then(r => r.json());
    const data = res.data;
    if (!data) return;

    document.getElementById("cur-temp").textContent  = `${data.current.temp}°`;
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

      let badge = "";
      if (d.superlative) {
        const cls = d.superlative === "Coldest" ? "cold" :
                    d.superlative === "Rainiest" ? "rain" :
                    d.superlative === "Snow!" ? "snow" : "";
        badge = `<div class="fday-badge ${cls}">${d.superlative}</div>`;
      }
      fd.innerHTML = `
        ${badge}
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

// =====================================================================
// DAILY QUOTE
// =====================================================================
async function loadQuote() {
  try {
    const q = await fetch("/api/quote").then(r => r.json());
    const strip = document.getElementById("quote-strip");
    strip.innerHTML = `"${q.text}"<span class="qauthor">${q.author}</span>`;
  } catch (e) { /* ignore */ }
}

// =====================================================================
// THEME (status bar label)
// =====================================================================
async function loadTheme() {
  try {
    const t = await fetch("/api/theme").then(r => r.json());
    currentThemeName = t.name || "";
  } catch (e) { /* ignore */ }
}

// =====================================================================
// SEASONAL SPARKLES
// =====================================================================
function applySeasonalEffect() {
  const now = new Date();
  const month = now.getMonth() + 1;  // 1-12
  const day   = now.getDate();
  document.body.classList.remove(
    "fx-snow", "fx-leaves", "fx-hearts", "fx-fireworks", "fx-confetti"
  );

  let kind = null;
  let chars = [];
  let count = 0;

  // Birthday confetti takes top priority.
  if (birthdaysToday.length) {
    kind = "fx-confetti";
    chars = ["🎉", "🎊", "🎈", "🎂", "✨"];
    count = 14;
  } else if (month === 12) {
    kind = "fx-snow";
    chars = ["❄", "❄️", "❅", "❆"];
    count = 14;
  } else if (month === 10) {
    kind = "fx-leaves";
    chars = ["🍂", "🍁", "🌰"];
    count = 10;
  } else if (month === 2 && day === 14) {
    kind = "fx-hearts";
    chars = ["❤️", "💕", "💖", "💗"];
    count = 12;
  } else if (month === 7 && day === 4) {
    kind = "fx-fireworks";
    chars = ["✨", "🎆", "🎇"];
    count = 8;
  }

  const wrap = document.getElementById("sparkles");
  wrap.innerHTML = "";
  if (!kind) return;

  document.body.classList.add(kind);
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    span.className = "fx";
    span.textContent = chars[Math.floor(Math.random() * chars.length)];
    span.style.left = Math.floor(Math.random() * 800) + "px";
    const duration = 8 + Math.random() * 14;     // 8-22s
    const delay    = -Math.random() * duration;  // start mid-cycle
    span.style.animationDuration = duration.toFixed(2) + "s";
    span.style.animationDelay = delay.toFixed(2) + "s";
    span.style.fontSize = (16 + Math.random() * 14).toFixed(0) + "px";
    wrap.appendChild(span);
  }
}

// =====================================================================
// SECRET TAP MENU (clock 5x within 3s)
// =====================================================================
function setupSecretTap() {
  const clock = document.getElementById("clock");
  const menu  = document.getElementById("secret-menu");
  const note  = document.getElementById("secret-note");
  const meta  = document.getElementById("secret-meta");

  let taps = [];
  function recordTap() {
    const now = Date.now();
    taps = taps.filter(t => now - t < 3000);
    taps.push(now);
    if (taps.length >= 5) {
      taps = [];
      openSecretMenu();
    }
  }
  clock.addEventListener("click", recordTap);
  clock.addEventListener("touchstart", recordTap);

  async function openSecretMenu() {
    note.textContent = ABOUT_NOTE;
    meta.innerHTML = "Loading…";
    menu.classList.remove("hidden");
    try {
      const sys = await fetch("/api/system").then(r => r.json());
      const secs = sys.uptime_seconds || 0;
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const uptime = h >= 24
        ? `${Math.floor(h / 24)}d ${h % 24}h ${m}m`
        : (h >= 1 ? `${h}h ${m}m` : `${m}m`);
      meta.innerHTML = `
        <div><span class="label">Theme this week:</span> ${sys.theme}</div>
        <div><span class="label">Location:</span> ${sys.weather_label || "—"}</div>
        <div><span class="label">Running for:</span> ${uptime}</div>
        <div><span class="label">Started:</span> ${new Date(sys.started_at).toLocaleString()}</div>
      `;
    } catch (e) {
      meta.textContent = "(couldn't load system info)";
    }
  }
  function closeMenu() { menu.classList.add("hidden"); }
  menu.addEventListener("click", closeMenu);
  menu.addEventListener("touchstart", closeMenu);
}

// =====================================================================
// BOOTSTRAP
// =====================================================================
async function loadAll() {
  await Promise.all([loadCalendar(), loadWeather(), loadQuote(), loadTheme()]);
  // News depends on birthdaysToday from loadCalendar().
  await loadNews();
  applySeasonalEffect();
  document.getElementById("status-bar").textContent =
    `Updated ${new Date().toLocaleTimeString()}` +
    (currentThemeName ? ` · ${currentThemeName}` : "");
}

loadAll();
setInterval(loadAll, REFRESH_MS);

updateClock();
setInterval(updateClock, CLOCK_MS);

setInterval(rotateNews, NEWS_ROTATE_MS);

document.getElementById("news-panel").addEventListener("click", rotateNews);

setupSecretTap();

// Self-heal: full reload once an hour to catch any drifted state.
setTimeout(() => location.reload(), 60 * 60 * 1000);
