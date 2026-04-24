const EXPENSE_WORDS = ["spent", "paid", "bought", "purchase", "expense", "cost"];
const BILL_WORDS = ["bill", "payment", "emi", "rent", "electricity", "internet", "phone", "water", "subscription"];
const HABIT_WORDS = ["every day", "daily", "gym", "walk", "exercise", "meditate", "study", "read"];
const SCHEDULE_WORDS = ["meeting", "call", "appointment", "schedule", "calendar"];

export function parseQuickInput(rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const amount = extractAmount(lower);
  const date = extractDate(lower);
  const recurrence = extractRecurrence(lower);
  const time = extractTime(lower);
  const type = detectType(lower, amount, recurrence);
  const title = cleanTitle(text);

  return {
    title,
    type,
    amount,
    category: detectCategory(lower, type),
    date: combineDateTime(date, time),
    recurrence,
    priority: detectPriority(lower),
    notes: text,
    source: "quick-input"
  };
}

function detectType(lower, amount, recurrence) {
  if (amount > 0 || EXPENSE_WORDS.some((word) => lower.includes(word))) return "expense";
  if (BILL_WORDS.some((word) => lower.includes(word))) return "bill";
  if (recurrence !== "none" && HABIT_WORDS.some((word) => lower.includes(word))) return "habit";
  if (SCHEDULE_WORDS.some((word) => lower.includes(word))) return "schedule";
  return "reminder";
}

function extractAmount(lower) {
  const currencyMatch = lower.match(/(?:rs\.?|inr|₹|\$)\s?(\d+(?:[.,]\d{1,2})?)/i);
  if (currencyMatch) return Number(currencyMatch[1].replace(",", ""));

  const expenseVerbMatch = lower.match(/\b(?:spent|paid|bought|purchase|cost)\b\D{0,18}(\d+(?:[.,]\d{1,2})?)/i);
  if (expenseVerbMatch) return Number(expenseVerbMatch[1].replace(",", ""));

  return 0;
}

function extractRecurrence(lower) {
  if (/\bevery\s+day\b|\bdaily\b/.test(lower)) return "daily";
  if (/\bevery\s+week\b|\bweekly\b/.test(lower)) return "weekly";
  if (/\bevery\s+month\b|\bmonthly\b/.test(lower)) return "monthly";
  return "none";
}

function extractDate(lower) {
  const now = new Date();
  if (lower.includes("tomorrow")) return addDays(startOfDay(now), 1);
  if (lower.includes("today")) return startOfDay(now);
  const dayMatch = lower.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayMatch) {
    const next = new Date(now.getFullYear(), now.getMonth(), Number(dayMatch[1]));
    if (next < startOfDay(now)) next.setMonth(next.getMonth() + 1);
    return next;
  }
  return startOfDay(now);
}

function extractTime(lower) {
  const match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/);
  if (!match) return { hours: 9, minutes: 0 };
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const suffix = match[3];
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  if (hours > 23) return { hours: 9, minutes: 0 };
  return { hours, minutes };
}

function combineDateTime(date, time) {
  const merged = new Date(date);
  merged.setHours(time.hours, time.minutes, 0, 0);
  return merged.toISOString();
}

function detectCategory(lower, type) {
  if (type === "expense" || type === "bill") {
    if (lower.includes("lunch") || lower.includes("food") || lower.includes("dinner")) return "Food";
    if (lower.includes("electricity") || lower.includes("internet") || lower.includes("phone")) return "Utilities";
    if (lower.includes("rent")) return "Housing";
    if (lower.includes("uber") || lower.includes("taxi") || lower.includes("fuel")) return "Transport";
    return type === "bill" ? "Bills" : "General";
  }
  if (type === "habit") return "Health";
  if (type === "schedule") return "Calendar";
  return "Personal";
}

function detectPriority(lower) {
  if (/\burgent\b|\bimportant\b|\bhigh\b/.test(lower)) return "high";
  if (/\blow\b|\blater\b/.test(lower)) return "low";
  return "normal";
}

function cleanTitle(text) {
  return text.replace(/\s+/g, " ").replace(/^(remind me to|add|create)\s+/i, "").trim();
}

function startOfDay(date) {
  const clone = new Date(date);
  clone.setHours(9, 0, 0, 0);
  return clone;
}

function addDays(date, days) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}
