import { dailySummary, groupByDay, nextOccurrence, upcomingItems } from "./modules/calendar.js";
import { exportExpensesCsv } from "./modules/exporter.js";
import { parseQuickInput } from "./modules/nlp.js";
import { registerServiceWorker, requestNotificationPermission, scheduleAlerts } from "./modules/notifications.js";
import { configureCloudEndpoint, syncNow } from "./modules/sync.js";
import { deleteItem, getAllItems, getHistory, getSetting, saveItem, setSetting } from "./modules/storage.js";

const app = document.querySelector("#app");
const state = {
  items: [],
  history: [],
  tab: "today",
  filter: "all",
  query: "",
  locked: false,
  settings: {
    darkMode: false,
    pinHash: "",
    cloudEndpoint: ""
  }
};

const typeLabels = {
  reminder: "Reminder",
  activity: "Activity",
  expense: "Expense",
  bill: "Bill",
  habit: "Habit",
  schedule: "Schedule",
  goal: "Goal"
};

init();

async function init() {
  await registerServiceWorker();
  state.settings.darkMode = await getSetting("darkMode", false);
  state.settings.pinHash = await getSetting("pinHash", "");
  state.settings.cloudEndpoint = await getSetting("cloudEndpoint", "");
  state.locked = Boolean(state.settings.pinHash);
  document.documentElement.dataset.theme = state.settings.darkMode ? "dark" : "light";
  await loadData();
  render();
}

async function loadData() {
  state.items = await getAllItems();
  state.history = await getHistory();
  scheduleAlerts(state.items);
}

function render() {
  if (state.locked) {
    app.innerHTML = lockScreen();
    bindLockEvents();
    return;
  }

  app.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">${formatLongDate(new Date())}</p>
        <h1>LifeOS</h1>
      </div>
      <button class="icon-btn" data-action="toggle-theme" aria-label="Toggle dark mode">${state.settings.darkMode ? "☀" : "◐"}</button>
    </header>
    <main>
      ${quickCapture()}
      ${summaryPanel()}
      ${tabBar()}
      <section class="content-panel">${renderCurrentTab()}</section>
    </main>
    ${bottomNav()}
  `;
  bindEvents();
}

function quickCapture() {
  return `
    <section class="quick-capture">
      <form id="quickForm" class="quick-form">
        <input id="quickInput" autocomplete="off" placeholder="Pay electricity bill on 28th" />
        <button type="button" class="icon-btn" data-action="voice" aria-label="Voice input">🎙</button>
        <button class="primary-btn" type="submit">Add</button>
      </form>
      <div id="parsedPreview" class="parsed-preview">Try: "Spent 500 on lunch" or "Gym every day at 6 AM"</div>
    </section>
  `;
}

function summaryPanel() {
  const summary = dailySummary(state.items);
  const monthSpend = monthlySpend(state.items);
  return `
    <section class="summary-grid">
      <article>
        <span>Today</span>
        <strong>${summary.open}</strong>
        <small>${summary.total} planned</small>
      </article>
      <article>
        <span>Expenses</span>
        <strong>${currency(summary.expenses)}</strong>
        <small>${currency(monthSpend)} this month</small>
      </article>
      <article>
        <span>Bills</span>
        <strong>${summary.bills}</strong>
        <small>due today</small>
      </article>
      <article>
        <span>Habits</span>
        <strong>${summary.habits}</strong>
        <small>tracked</small>
      </article>
    </section>
  `;
}

function tabBar() {
  const tabs = [
    ["today", "Today"],
    ["calendar", "Calendar"],
    ["money", "Money"],
    ["history", "History"],
    ["settings", "Settings"]
  ];
  return `
    <nav class="tabs">
      ${tabs.map(([id, label]) => `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}
    </nav>
  `;
}

function renderCurrentTab() {
  if (state.tab === "calendar") return calendarView();
  if (state.tab === "money") return moneyView();
  if (state.tab === "history") return historyView();
  if (state.tab === "settings") return settingsView();
  return todayView();
}

function todayView() {
  const items = filteredItems();
  const upcoming = upcomingItems(state.items, 5);
  return `
    <div class="toolbar">
      <input id="searchInput" value="${escapeHtml(state.query)}" placeholder="Search tasks, bills, expenses" />
      <select id="filterSelect">
        ${["all", "reminder", "expense", "bill", "habit", "schedule", "goal"].map((type) => `
          <option value="${type}" ${state.filter === type ? "selected" : ""}>${type === "all" ? "All" : typeLabels[type]}</option>
        `).join("")}
      </select>
    </div>
    <div class="section-title">
      <h2>Active List</h2>
      <button class="ghost-btn" data-action="add-sample">Sample</button>
    </div>
    <div class="item-list">${items.length ? items.map(itemCard).join("") : emptyState("No items yet")}</div>
    <div class="section-title"><h2>Next Up</h2></div>
    <div class="mini-list">${upcoming.map(compactItem).join("") || emptyState("No upcoming alerts")}</div>
  `;
}

function calendarView() {
  const groups = groupByDay(state.items.slice().sort((a, b) => new Date(a.date) - new Date(b.date)));
  return Object.entries(groups)
    .slice(0, 20)
    .map(([day, items]) => `
      <section class="day-group">
        <h2>${formatDay(day)}</h2>
        ${items.map(compactItem).join("")}
      </section>
    `)
    .join("") || emptyState("Calendar is clear");
}

function moneyView() {
  const financial = state.items.filter((item) => item.type === "expense" || item.type === "bill");
  const byCategory = financial.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(byCategory));
  return `
    <div class="section-title">
      <h2>Expense Reports</h2>
      <button class="primary-btn small" data-action="export">Export CSV</button>
    </div>
    <div class="report-total">${currency(financial.reduce((sum, item) => sum + item.amount, 0))}</div>
    <div class="chart-list">
      ${Object.entries(byCategory).map(([category, amount]) => `
        <div class="bar-row">
          <div><strong>${escapeHtml(category || "General")}</strong><span>${currency(amount)}</span></div>
          <i style="width:${Math.max(8, (amount / max) * 100)}%"></i>
        </div>
      `).join("") || emptyState("No expenses recorded")}
    </div>
    <div class="insight-box">${expenseInsight(financial)}</div>
  `;
}

function historyView() {
  return `
    <div class="section-title"><h2>History</h2></div>
    <div class="mini-list">
      ${state.history.map((entry) => `
        <article class="history-row">
          <strong>${escapeHtml(entry.action)}</strong>
          <span>${formatDateTime(entry.createdAt)}</span>
        </article>
      `).join("") || emptyState("No history yet")}
    </div>
  `;
}

function settingsView() {
  return `
    <form id="settingsForm" class="settings-form">
      <label class="switch-row">
        <span>
          <strong>Dark mode</strong>
          <small>Comfortable low-light UI</small>
        </span>
        <input type="checkbox" name="darkMode" ${state.settings.darkMode ? "checked" : ""} />
      </label>
      <label>
        <span>Cloud sync endpoint</span>
        <input name="cloudEndpoint" value="${escapeHtml(state.settings.cloudEndpoint)}" placeholder="https://api.example.com/sync" />
      </label>
      <label>
        <span>PIN lock</span>
        <input name="pin" inputmode="numeric" maxlength="6" placeholder="${state.settings.pinHash ? "PIN enabled" : "Set 4-6 digit PIN"}" />
      </label>
      <div class="settings-actions">
        <button class="primary-btn" type="submit">Save</button>
        <button class="ghost-btn" type="button" data-action="sync">Sync now</button>
        <button class="ghost-btn" type="button" data-action="notify">Enable alerts</button>
      </div>
    </form>
    <div class="roadmap">
      <h2>Expansion Modules</h2>
      <p>Investment tracker, income tracker, subscriptions, health, notes, AI assistant, business tasks, teams, and automation can plug into the same item, history, sync, and notification services.</p>
    </div>
  `;
}

function itemCard(item) {
  return `
    <article class="item-card ${item.priority === "high" ? "priority" : ""}">
      <div>
        <span class="pill">${typeLabels[item.type] || item.type}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${formatDateTime(item.date)}${item.recurrence !== "none" ? ` · ${item.recurrence}` : ""}</p>
      </div>
      <div class="item-actions">
        ${item.amount ? `<strong>${currency(item.amount)}</strong>` : ""}
        <button class="icon-btn" data-action="done" data-id="${item.id}" aria-label="Mark done">✓</button>
        <button class="icon-btn danger" data-action="delete" data-id="${item.id}" aria-label="Delete">×</button>
      </div>
    </article>
  `;
}

function compactItem(item) {
  return `
    <article class="compact-item">
      <span class="dot ${item.type}"></span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${typeLabels[item.type] || item.type} · ${formatDateTime(item.date)}</small>
      </div>
      ${item.amount ? `<b>${currency(item.amount)}</b>` : ""}
    </article>
  `;
}

function bottomNav() {
  return `
    <footer class="bottom-nav">
      <button data-tab="today" class="${state.tab === "today" ? "active" : ""}">Home</button>
      <button data-tab="calendar" class="${state.tab === "calendar" ? "active" : ""}">Plan</button>
      <button data-tab="money" class="${state.tab === "money" ? "active" : ""}">Money</button>
      <button data-tab="settings" class="${state.tab === "settings" ? "active" : ""}">More</button>
    </footer>
  `;
}

function lockScreen() {
  return `
    <main class="lock-screen">
      <h1>LifeOS</h1>
      <p>Enter your PIN</p>
      <form id="unlockForm">
        <input id="pinInput" inputmode="numeric" type="password" maxlength="6" autofocus />
        <button class="primary-btn">Unlock</button>
      </form>
    </main>
  `;
}

function bindEvents() {
  document.querySelector("#quickForm")?.addEventListener("submit", addQuickItem);
  document.querySelector("#quickInput")?.addEventListener("input", updatePreview);
  document.querySelector("#searchInput")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  document.querySelector("#filterSelect")?.addEventListener("change", (event) => {
    state.filter = event.target.value;
    render();
  });
  document.querySelector("#settingsForm")?.addEventListener("submit", saveSettings);
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      render();
    });
  });
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", handleAction));
}

function bindLockEvents() {
  document.querySelector("#unlockForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = document.querySelector("#pinInput").value;
    if ((await hashPin(pin)) === state.settings.pinHash) {
      state.locked = false;
      render();
    }
  });
}

async function addQuickItem(event) {
  event.preventDefault();
  const input = document.querySelector("#quickInput");
  if (!input.value.trim()) return;
  await saveItem(parseQuickInput(input.value));
  input.value = "";
  await loadData();
  render();
}

function updatePreview(event) {
  const preview = document.querySelector("#parsedPreview");
  if (!event.target.value.trim()) {
    preview.textContent = 'Try: "Spent 500 on lunch" or "Gym every day at 6 AM"';
    return;
  }
  const parsed = parseQuickInput(event.target.value);
  preview.textContent = `${typeLabels[parsed.type]} · ${formatDateTime(parsed.date)} · ${parsed.recurrence}`;
}

async function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;
  if (action === "toggle-theme") return toggleTheme();
  if (action === "notify") return requestNotificationPermission();
  if (action === "export") return exportExpensesCsv(state.items);
  if (action === "sync") return runSync();
  if (action === "voice") return startVoiceInput();
  if (action === "add-sample") return addSamples();
  if (action === "delete") {
    await deleteItem(id);
    await loadData();
    render();
  }
  if (action === "done") {
    const item = state.items.find((record) => record.id === id);
    if (!item) return;
    await saveItem({ ...item, status: "done" });
    const next = nextOccurrence(item);
    if (next) await saveItem(next);
    await loadData();
    render();
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  state.settings.darkMode = form.get("darkMode") === "on";
  state.settings.cloudEndpoint = form.get("cloudEndpoint") || "";
  await setSetting("darkMode", state.settings.darkMode);
  await configureCloudEndpoint(state.settings.cloudEndpoint);
  const pin = String(form.get("pin") || "").trim();
  if (pin.length >= 4) {
    state.settings.pinHash = await hashPin(pin);
    await setSetting("pinHash", state.settings.pinHash);
  }
  document.documentElement.dataset.theme = state.settings.darkMode ? "dark" : "light";
  render();
}

async function toggleTheme() {
  state.settings.darkMode = !state.settings.darkMode;
  await setSetting("darkMode", state.settings.darkMode);
  document.documentElement.dataset.theme = state.settings.darkMode ? "dark" : "light";
  render();
}

async function runSync() {
  try {
    const result = await syncNow();
    alert(`Sync status: ${result.status}. Records synced: ${result.synced}.`);
  } catch (error) {
    alert(error.message);
  }
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice input is not supported in this browser.");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.onresult = (event) => {
    const input = document.querySelector("#quickInput");
    input.value = event.results[0][0].transcript;
    updatePreview({ target: input });
  };
  recognition.start();
}

async function addSamples() {
  const samples = [
    "Pay electricity bill on 28th",
    "Spent 500 on lunch",
    "Meeting tomorrow at 4 PM",
    "Gym every day at 6 AM"
  ];
  for (const sample of samples) await saveItem(parseQuickInput(sample));
  await loadData();
  render();
}

function filteredItems() {
  return state.items
    .filter((item) => state.filter === "all" || item.type === state.filter)
    .filter((item) => `${item.title} ${item.category} ${item.notes}`.toLowerCase().includes(state.query.toLowerCase()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function monthlySpend(items) {
  const month = new Date().toISOString().slice(0, 7);
  return items
    .filter((item) => (item.type === "expense" || item.type === "bill") && item.date.slice(0, 7) === month)
    .reduce((sum, item) => sum + item.amount, 0);
}

function expenseInsight(items) {
  if (!items.length) return "AI insight placeholder: add expenses to unlock spending patterns and bill risk signals.";
  const top = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});
  const [category, amount] = Object.entries(top).sort((a, b) => b[1] - a[1])[0];
  return `AI insight: ${category} is your largest tracked category at ${currency(amount)}. Watch recurring bills before month end.`;
}

async function hashPin(pin) {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function currency(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function formatDay(day) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date(day));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
