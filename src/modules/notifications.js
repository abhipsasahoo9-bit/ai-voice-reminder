const activeTimers = new Map();

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("./sw.js");
    return true;
  } catch (error) {
    console.info("Service worker unavailable in this context.", error);
    return false;
  }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

export function scheduleAlerts(items) {
  activeTimers.forEach((timer) => clearTimeout(timer));
  activeTimers.clear();

  items
    .filter((item) => ["reminder", "bill", "schedule", "habit"].includes(item.type))
    .filter((item) => item.status !== "done")
    .forEach((item) => {
      const due = new Date(item.date).getTime();
      const delay = due - Date.now();
      if (delay < 0 || delay > 2147483647) return;
      const timer = setTimeout(() => showAlert(item), delay);
      activeTimers.set(item.id, timer);
    });
}

export async function showAlert(item) {
  playAlarm();
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker?.ready;
  const title = item.priority === "high" ? `Priority: ${item.title}` : item.title;
  const options = {
    body: `${labelForType(item.type)} due now`,
    icon: "./assets/icon.svg",
    badge: "./assets/icon.svg",
    tag: item.id,
    requireInteraction: item.priority === "high" || item.type === "bill",
    vibrate: [300, 120, 300, 120, 500]
  };
  if (registration) registration.showNotification(title, options);
  else new Notification(title, options);
}

export function playAlarm() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const gain = context.createGain();
  gain.gain.value = 0.08;
  gain.connect(context.destination);

  [0, 0.22, 0.44, 0.76].forEach((offset) => {
    const oscillator = context.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = 880;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.16);
  });
}

function labelForType(type) {
  return {
    reminder: "Reminder",
    bill: "Bill",
    schedule: "Schedule",
    habit: "Habit"
  }[type] || "Task";
}
