# LifeOS Reminder

Mobile-first personal life manager for reminders, daily activity, expenses, bills, habits, goals, calendar planning, and productivity workflows.

## Run

```powershell
cd C:\Users\erdai\reminder-app
node server.mjs
```

Open:

```text
http://localhost:4173
```

The app can also be opened from `index.html`, but Android install support, service worker caching, and stronger notification behavior require localhost or HTTPS.

## Current Features

- Quick text input with natural-language detection
- Reminder, expense, bill, habit, and schedule classification
- Daily, weekly, and monthly recurrence handling
- IndexedDB offline-first local storage
- Search, filter, item history, and expense CSV export
- Dashboard, calendar, money reports, settings, dark mode
- Browser notifications, generated alert sound, vibration pattern
- Voice input through the Web Speech API where supported
- PIN lock using a local SHA-256 hash
- Cloud sync adapter stub for later backend integration
- PWA manifest and service worker for Android install readiness

## Architecture

```text
src/
  main.js                  App shell, state, rendering, event orchestration
  styles.css               Mobile-first UI system
  modules/
    storage.js             IndexedDB repositories, settings, history, sync queue
    nlp.js                 Quick input parsing and intent detection
    notifications.js       Service worker registration, alerts, alarm sound
    calendar.js            Date grouping, recurrence, daily summaries
    exporter.js            Expense report export
    sync.js                Future cloud backup and multi-device sync adapter
```

Future modules should be added under `src/modules` and connected through `main.js` only at the app orchestration boundary. Shared persistence should go through `storage.js` so history, sync, and offline support remain consistent.

## Expansion Targets

- Backend authentication and encrypted cloud sync
- Real push notification server integration
- AI assistant API integration
- Investment, income, subscription, health, notes, and team modules
- Automation workflow engine
- Native wrapper through Capacitor or a full React Native migration

## Android APK

This repo includes a Capacitor Android project.

Prerequisites:

- Android Studio
- Android SDK
- Java/JDK, usually bundled with Android Studio

Prepare Android assets:

```powershell
npm run build
npx cap sync android
```

Open in Android Studio:

```powershell
npx cap open android
```

Build APK from Android Studio:

```text
Build -> Build Bundle(s) / APK(s) -> Build APK(s)
```

Or build from terminal after Java and Android SDK are configured:

```powershell
android\gradlew.bat -p android assembleDebug
```

Debug APK output:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```
