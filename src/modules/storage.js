const DB_NAME = "lifeos-db";
const DB_VERSION = 1;
const STORES = ["items", "settings", "syncQueue", "history"];

let dbPromise;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("items")) {
        const items = db.createObjectStore("items", { keyPath: "id" });
        items.createIndex("type", "type");
        items.createIndex("date", "date");
        items.createIndex("status", "status");
        items.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
      if (!db.objectStoreNames.contains("syncQueue")) db.createObjectStore("syncQueue", { keyPath: "id" });
      if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "id" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx(storeName, mode = "readonly") {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAllItems() {
  const store = await tx("items");
  return promisify(store.getAll());
}

export async function saveItem(item) {
  const now = new Date().toISOString();
  const record = {
    id: item.id || createId(item.type || "item"),
    title: item.title || "Untitled",
    type: item.type || "activity",
    amount: Number(item.amount || 0),
    category: item.category || "",
    date: item.date || now,
    recurrence: item.recurrence || "none",
    priority: item.priority || "normal",
    status: item.status || "open",
    notes: item.notes || "",
    source: item.source || "manual",
    createdAt: item.createdAt || now,
    updatedAt: now
  };
  const store = await tx("items", "readwrite");
  await promisify(store.put(record));
  await addHistory("item.saved", record);
  await queueSync("upsert", record);
  return record;
}

export async function deleteItem(id) {
  const store = await tx("items", "readwrite");
  await promisify(store.delete(id));
  await addHistory("item.deleted", { id });
  await queueSync("delete", { id });
}

export async function addHistory(action, payload) {
  const store = await tx("history", "readwrite");
  return promisify(
    store.put({
      id: createId("history"),
      action,
      payload,
      createdAt: new Date().toISOString()
    })
  );
}

export async function getHistory(limit = 60) {
  const store = await tx("history");
  const records = await promisify(store.getAll());
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function getSetting(key, fallback = null) {
  const store = await tx("settings");
  const record = await promisify(store.get(key));
  return record ? record.value : fallback;
}

export async function setSetting(key, value) {
  const store = await tx("settings", "readwrite");
  return promisify(store.put({ key, value, updatedAt: new Date().toISOString() }));
}

export async function queueSync(action, payload) {
  const store = await tx("syncQueue", "readwrite");
  return promisify(
    store.put({
      id: createId("sync"),
      action,
      payload,
      createdAt: new Date().toISOString()
    })
  );
}

export async function getSyncQueue() {
  const store = await tx("syncQueue");
  return promisify(store.getAll());
}

export async function clearSyncRecord(id) {
  const store = await tx("syncQueue", "readwrite");
  return promisify(store.delete(id));
}
