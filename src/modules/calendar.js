export function groupByDay(items) {
  return items.reduce((groups, item) => {
    const key = item.date.slice(0, 10);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

export function upcomingItems(items, limit = 8) {
  const now = Date.now();
  return items
    .filter((item) => new Date(item.date).getTime() >= now && item.status !== "done")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, limit);
}

export function dailySummary(items) {
  const today = new Date().toISOString().slice(0, 10);
  const todays = items.filter((item) => item.date.slice(0, 10) === today);
  const expenses = todays.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  return {
    total: todays.length,
    open: todays.filter((item) => item.status !== "done").length,
    expenses,
    bills: todays.filter((item) => item.type === "bill").length,
    habits: todays.filter((item) => item.type === "habit").length
  };
}

export function nextOccurrence(item) {
  if (item.recurrence === "none") return null;
  const next = new Date(item.date);
  if (item.recurrence === "daily") next.setDate(next.getDate() + 1);
  if (item.recurrence === "weekly") next.setDate(next.getDate() + 7);
  if (item.recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return { ...item, id: undefined, status: "open", date: next.toISOString() };
}
