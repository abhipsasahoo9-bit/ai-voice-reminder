import { clearSyncRecord, getSetting, getSyncQueue, setSetting } from "./storage.js";

export async function configureCloudEndpoint(url) {
  await setSetting("cloudEndpoint", url.trim());
}

export async function syncNow() {
  const endpoint = await getSetting("cloudEndpoint", "");
  const queue = await getSyncQueue();
  if (!endpoint) return { status: "disabled", synced: 0 };
  if (!navigator.onLine) return { status: "offline", synced: 0 };

  let synced = 0;
  for (const record of queue) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!response.ok) throw new Error(`Sync failed with ${response.status}`);
    await clearSyncRecord(record.id);
    synced += 1;
  }
  return { status: "synced", synced };
}
