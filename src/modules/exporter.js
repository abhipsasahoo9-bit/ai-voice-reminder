export function exportExpensesCsv(items) {
  const expenses = items.filter((item) => item.type === "expense" || item.type === "bill");
  const rows = [["Date", "Type", "Title", "Category", "Amount", "Status", "Notes"]];
  expenses.forEach((item) => {
    rows.push([
      item.date.slice(0, 10),
      item.type,
      item.title,
      item.category,
      item.amount,
      item.status,
      item.notes
    ]);
  });

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lifeos-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
