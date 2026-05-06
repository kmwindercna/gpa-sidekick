// Grandpa's Sidekick — frontend controller
const REFRESH_MS = 5 * 60 * 1000;        // refetch APIs every 5 min
const NEWS_ROTATE_MS = 12 * 1000;        // rotate news every 12 sec
const CLOCK_MS = 1000;
const DETAIL_AUTO_HOME_MS = 45 * 1000;   // auto-return home after 45s of no touch

const CFG = window.__GPS_CONFIG__ || {};
const NAMES = (CFG.names && CFG.names.length) ? CFG.names : ["Friend"];
const ABOUT_NOTE = CFG.aboutNote || "Hi from Kyle ❤️";

const pad = n => (n < 10 ? "0" + n : "" + n);
const DAY_NAMES_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_NAMES_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let newsItems = [];
let newsIdx = 0;
let weatherData = null;
let currentThemeName = "";
let birthdaysToday = [];

// View state — "home" or "detail" (when detail is open)
let currentView = "home";
let detailContext = null;       // { kind, idx, payload } for the active detail
let inactivityTimer = null;

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

  if (now.getMinutes() !== lastGreetingMinute) {
    lastGreetingMinute = now.getMinutes();
    document.getElementById("greeting").textContent =
      `${timeOfDayPhrase(h)}, ${pickName()}`;
  }
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
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const d = new Date(date); d.setHours(0,0,0,0);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return `${DAY_NAMES_LONG[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}
function fmtPublished(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h ago`;
  return `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// =====================================================================
// CALENDAR + HOLIDAYS + BIRTHDAYS
// =====================================================================
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
        location: e.location || "",
        start: e.start,
        all_day: e.all_day,
      });
    }
    for (const h of (holRes.upcoming || [])) {
      items.push({
        type: "holiday",
        summary: h.name,
        location: "",
        start: h.date + "T00:00:00",
        all_day: true,
      });
    }
    for (const b of (bdRes.upcoming || [])) {
      items.push({
        type: "birthday",
        summary: `${b.name}'s Birthday`,
        location: "",
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
      ev.addEventListener("click", () => openDetail("event", { item }));
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

    for (const b of birthdaysToday) {
      items.push({
        kind: "birthday",
        source: "🎂 Today",
        title: `Happy Birthday, ${b.name}!`,
        summary: "",
        image: null,
      });
    }

    const otd = (otdRes && otdRes.event) || null;
    if (otd && otd.text) {
      items.push({
        kind: "otd",
        source: otd.year ? `On This Day · ${otd.year}` : "On This Day",
        title: otd.text,
        summary: "",
        image: otd.image || null,
        year: otd.year || null,
      });
    }

    for (const n of (newsRes.items || [])) {
      items.push({
        kind: "news",
        source: n.source,
        title: n.title,
        summary: n.summary || "",
        image: n.image,
        published: n.published,
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
    weatherData = res.data;
    if (!weatherData) return;

    document.getElementById("cur-temp").textContent  = `${weatherData.current.temp}°`;
    document.getElementById("cur-emoji").textContent = weatherData.current.emoji;
    const labelEl = document.getElementById("cur-label");
    if (labelEl && labelEl.textContent.trim() === "") {
      labelEl.textContent = weatherData.current.label;
    }

    const daysEl = document.getElementById("forecast-days");
    daysEl.innerHTML = "";
    (weatherData.daily || []).forEach((d, i) => {
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
      fd.addEventListener("click", () => openDetail("weather", { dayIdx: i }));
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
// THEME
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
  const month = now.getMonth() + 1;
  const day   = now.getDate();
  document.body.classList.remove(
    "fx-snow", "fx-leaves", "fx-hearts", "fx-fireworks", "fx-confetti"
  );

  let kind = null, chars = [], count = 0;
  if (birthdaysToday.length) { kind = "fx-confetti"; chars = ["🎉","🎊","🎈","🎂","✨"]; count = 14; }
  else if (month === 12)             { kind = "fx-snow";    chars = ["❄","❄️","❅","❆"];  count = 14; }
  else if (month === 10)             { kind = "fx-leaves";  chars = ["🍂","🍁","🌰"];      count = 10; }
  else if (month === 2 && day === 14) { kind = "fx-hearts";  chars = ["❤️","💕","💖","💗"]; count = 12; }
  else if (month === 7 && day === 4)  { kind = "fx-fireworks"; chars = ["✨","🎆","🎇"];   count = 8;  }

  const wrap = document.getElementById("sparkles");
  wrap.innerHTML = "";
  if (!kind) return;

  document.body.classList.add(kind);
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    span.className = "fx";
    span.textContent = chars[Math.floor(Math.random() * chars.length)];
    span.style.left = Math.floor(Math.random() * 800) + "px";
    const duration = 8 + Math.random() * 14;
    const delay    = -Math.random() * duration;
    span.style.animationDuration = duration.toFixed(2) + "s";
    span.style.animationDelay = delay.toFixed(2) + "s";
    span.style.fontSize = (16 + Math.random() * 14).toFixed(0) + "px";
    wrap.appendChild(span);
  }
}

// =====================================================================
// DETAIL VIEW (news / weather / event)
// =====================================================================
function openDetail(kind, payload) {
  currentView = "detail";
  detailContext = { kind, payload };
  // For news: lock the current news index so back/forward navigation works.
  if (kind === "news-current") {
    detailContext = { kind: "news", payload: { idx: newsIdx % Math.max(newsItems.length, 1) } };
  }
  renderDetail();
  document.getElementById("detail-view").classList.remove("hidden");
  resetInactivityTimer();
}

function closeDetail() {
  currentView = "home";
  detailContext = null;
  document.getElementById("detail-view").classList.add("hidden");
  clearInactivityTimer();
}

function clearInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  const bar = document.getElementById("detail-timer");
  bar.style.transition = "none";
  bar.style.transform = "scaleX(1)";
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  const bar = document.getElementById("detail-timer");
  bar.style.transition = "none";
  bar.style.transform = "scaleX(1)";
  // next frame, animate to zero over the timeout window
  requestAnimationFrame(() => {
    bar.style.transition = `transform ${DETAIL_AUTO_HOME_MS}ms linear`;
    bar.style.transform = "scaleX(0)";
  });
  inactivityTimer = setTimeout(closeDetail, DETAIL_AUTO_HOME_MS);
}

function renderDetail() {
  const titleEl = document.getElementById("detail-title");
  const navEl   = document.getElementById("detail-nav");
  const bodyEl  = document.getElementById("detail-body");
  navEl.innerHTML = "";
  bodyEl.innerHTML = "";
  if (!detailContext) return;

  const { kind, payload } = detailContext;

  if (kind === "news") {
    renderNewsDetail(payload, titleEl, navEl, bodyEl);
  } else if (kind === "weather") {
    renderWeatherDetail(payload, titleEl, bodyEl);
  } else if (kind === "event") {
    renderEventDetail(payload, titleEl, bodyEl);
  }
}

function renderNewsDetail(payload, titleEl, navEl, bodyEl) {
  const idx = ((payload.idx % newsItems.length) + newsItems.length) % newsItems.length;
  const item = newsItems[idx];
  if (!item) {
    titleEl.textContent = "News";
    bodyEl.textContent = "No news loaded.";
    return;
  }

  titleEl.textContent = item.source || "News";

  // Prev / Next buttons
  const prev = document.createElement("button");
  prev.type = "button";
  prev.textContent = "‹ Prev";
  prev.addEventListener("click", (e) => {
    e.stopPropagation();
    detailContext.payload.idx = (idx - 1 + newsItems.length) % newsItems.length;
    renderDetail();
    resetInactivityTimer();
  });
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next ›";
  next.addEventListener("click", (e) => {
    e.stopPropagation();
    detailContext.payload.idx = (idx + 1) % newsItems.length;
    renderDetail();
    resetInactivityTimer();
  });
  if (newsItems.length > 1) {
    navEl.appendChild(prev);
    navEl.appendChild(next);
  }

  if (item.image) {
    const img = document.createElement("div");
    img.className = "dn-image";
    img.style.backgroundImage = `url('${item.image.replace(/'/g, "\\'")}')`;
    bodyEl.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "dn-meta";
  const src = document.createElement("span");
  src.className = "dn-source";
  src.textContent = item.source || "";
  meta.appendChild(src);
  if (item.published) {
    const pub = document.createElement("span");
    pub.textContent = fmtPublished(item.published);
    meta.appendChild(pub);
  }
  bodyEl.appendChild(meta);

  const t = document.createElement("div");
  t.className = "dn-title";
  t.textContent = item.title || "";
  bodyEl.appendChild(t);

  const s = document.createElement("div");
  s.className = "dn-summary";
  s.textContent = item.summary || "";
  bodyEl.appendChild(s);
}

function renderWeatherDetail(payload, titleEl, bodyEl) {
  if (!weatherData || !weatherData.daily) {
    titleEl.textContent = "Weather";
    bodyEl.textContent = "Weather not loaded.";
    return;
  }
  const idx = Math.max(0, Math.min(payload.dayIdx, weatherData.daily.length - 1));
  const day = weatherData.daily[idx];
  const dt = new Date(day.date + "T12:00:00");
  const isToday = idx === 0;

  titleEl.textContent = isToday
    ? `Today · ${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`
    : `${DAY_NAMES_LONG[dt.getDay()]} · ${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`;

  const dayEl = document.createElement("div");
  dayEl.className = "dw-day";
  dayEl.textContent = isToday ? "Today's Forecast" : DAY_NAMES_LONG[dt.getDay()];
  bodyEl.appendChild(dayEl);

  const cond = document.createElement("div");
  cond.className = "dw-condition";
  cond.innerHTML = `
    <span class="dw-emoji">${day.emoji}</span>
    <span class="dw-cond-text">${day.label}</span>
  `;
  bodyEl.appendChild(cond);

  const temps = document.createElement("div");
  temps.className = "dw-temps";
  temps.innerHTML = `
    <div class="dw-temp high"><div class="lab">High</div><div class="val">${day.high}°</div></div>
    <div class="dw-temp low"><div class="lab">Low</div><div class="val">${day.low}°</div></div>
  `;
  bodyEl.appendChild(temps);

  const meta = document.createElement("div");
  meta.className = "dw-meta-grid";
  const precip = (day.precip_chance == null) ? "—" : `${day.precip_chance}%`;
  if (isToday && weatherData.current) {
    const c = weatherData.current;
    meta.innerHTML = `
      <div class="dw-stat"><div class="lab">Right Now</div><div class="val">${c.temp}°</div></div>
      <div class="dw-stat"><div class="lab">Feels Like</div><div class="val">${c.feels_like}°</div></div>
      <div class="dw-stat"><div class="lab">Rain Chance</div><div class="val cool">${precip}</div></div>
      <div class="dw-stat"><div class="lab">Humidity</div><div class="val">${c.humidity != null ? c.humidity + "%" : "—"}</div></div>
      <div class="dw-stat"><div class="lab">Wind</div><div class="val">${c.wind} mph</div></div>
      <div class="dw-stat"><div class="lab">Conditions</div><div class="val" style="font-size:14px;line-height:1.3">${c.label}</div></div>
    `;
  } else {
    meta.innerHTML = `
      <div class="dw-stat"><div class="lab">High</div><div class="val warm">${day.high}°</div></div>
      <div class="dw-stat"><div class="lab">Low</div><div class="val cool">${day.low}°</div></div>
      <div class="dw-stat"><div class="lab">Rain Chance</div><div class="val cool">${precip}</div></div>
    `;
  }
  bodyEl.appendChild(meta);
}

function renderEventDetail(payload, titleEl, bodyEl) {
  const item = payload.item;
  if (!item) {
    titleEl.textContent = "Event";
    bodyEl.textContent = "No event selected.";
    return;
  }
  titleEl.textContent =
    item.type === "holiday"  ? "Holiday"  :
    item.type === "birthday" ? "Birthday" :
    "Calendar Event";

  const dayEl = document.createElement("div");
  dayEl.className = "de-day";
  dayEl.textContent = dayLabel(item.start);
  bodyEl.appendChild(dayEl);

  const timeEl = document.createElement("div");
  timeEl.className = "de-time";
  timeEl.textContent = fmtEventTime(item.start, item.all_day);
  bodyEl.appendChild(timeEl);

  if (item.type !== "event") {
    const tag = document.createElement("span");
    tag.className = `de-tag ${item.type}`;
    tag.textContent = item.type === "birthday" ? "Birthday 🎂" : "Holiday 🎉";
    bodyEl.appendChild(tag);
  }

  const titleRow = document.createElement("div");
  titleRow.className = "de-title";
  titleRow.textContent = item.summary;
  bodyEl.appendChild(titleRow);

  if (item.location) {
    const loc = document.createElement("div");
    loc.className = "de-location";
    loc.textContent = item.location;
    bodyEl.appendChild(loc);
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
  function recordTap(e) {
    e.stopPropagation();
    const now = Date.now();
    taps = taps.filter(t => now - t < 3000);
    taps.push(now);
    if (taps.length >= 5) {
      taps = [];
      openSecretMenu();
    }
  }
  clock.addEventListener("click", recordTap);

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
}

// =====================================================================
// BOOTSTRAP
// =====================================================================
async function loadAll() {
  await Promise.all([loadCalendar(), loadWeather(), loadQuote(), loadTheme()]);
  await loadNews();
  applySeasonalEffect();
  document.getElementById("status-bar").textContent =
    `Updated ${new Date().toLocaleTimeString()}` +
    (currentThemeName ? ` · ${currentThemeName}` : "");
  // If detail view is open with stale data, re-render with fresh data.
  if (currentView === "detail") renderDetail();
}

loadAll();
setInterval(loadAll, REFRESH_MS);

updateClock();
setInterval(updateClock, CLOCK_MS);

// News auto-rotation only fires on the home view.
setInterval(() => { if (currentView === "home") rotateNews(); }, NEWS_ROTATE_MS);

// Tap the news panel to open detail for the currently visible item.
document.getElementById("news-panel").addEventListener("click", () => {
  if (!newsItems.length) return;
  openDetail("news-current", null);
});

// Tap current weather (in the header) to open weather detail for today.
document.getElementById("cur-weather").addEventListener("click", () => {
  if (!weatherData) return;
  openDetail("weather", { dayIdx: 0 });
});

// Detail-view interactions: back button + reset inactivity on any tap.
document.getElementById("detail-back").addEventListener("click", closeDetail);
document.getElementById("detail-view").addEventListener("click", () => {
  if (currentView === "detail") resetInactivityTimer();
});

setupSecretTap();

// Self-heal: full reload once an hour to catch any drifted state.
setTimeout(() => location.reload(), 60 * 60 * 1000);
