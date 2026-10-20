# Tasko

A gamified to-do list with a liquid glass look. Runs on the web and as a native iPhone app (see [iPhone app](#iphone-app)).

**Live app:** https://alexmaxham.github.io/Claude/

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # core logic tests
npm run build     # production build in dist/
```

Every push to the default branch runs the tests, builds, and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Accounts and sync (Firebase)

Sign-in (Google or email/password) and cloud sync use Firebase. Until it's configured the app works as before, saving in the browser only, and the Sign in button is hidden.

One-time setup:

1. Create a project at https://console.firebase.google.com (Google Analytics not needed).
2. **Authentication** → Get started → Sign-in method: enable **Google** and **Email/Password** (and **Apple** for the iPhone app, see below).
3. **Authentication** → Settings → Authorized domains: add `alexmaxham.github.io`.
4. **Firestore Database** → Create database (production mode, any region). Open the **Rules** tab, paste the contents of `firestore.rules`, and publish.
5. **Project settings** → General → Your apps → add a **Web** app. Copy the `firebaseConfig` values into `src/cloud/config.ts` and push.

Google Calendar sync (one-time setup, needed before **Sync now** works):

1. Enable the **Google Calendar API** for the project: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=questlog2-e03f9
2. Google Cloud console → **APIs & Services → OAuth consent screen** (Google Auth Platform → Data access): add the scope `https://www.googleapis.com/auth/calendar.events`. Until Google verifies the app, people see an "unverified app" warning and can continue via *Advanced*; that's fine for personal use (up to 100 users).

The app asks for calendar access with a Google popup the first time you sync. Accounts created with email get Google linked to them. Only events Tasko created are ever changed.

How it works:

- Each user has one Firestore document, `users/{uid}`, holding their whole app state. The rules allow only that user to read or write it.
- Signing in for the first time keeps anything you did as a guest. If the account already has data, the two are merged: tasks are combined and XP is added together.
- Changes save about a second after you make them and appear live on your other devices. It works offline and catches up when you reconnect.
- Signing out removes the account's data from that device.
- **Account → Delete account** (tap your profile picture → Account) permanently deletes the account and its Firestore document after the user confirms who they are. This needs the current `firestore.rules`, which allow users to delete their own document.

Local testing with the Firebase emulators (needs Java):

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-tasko
VITE_FIREBASE_EMULATORS=true npm run dev
```

## Features

- **Quick add:** type and press Enter. Tap ⌄ to add a description or set category, priority and due date. Press `N` anywhere to jump to the input.
- **Descriptions:** each task can have optional notes. The first two lines show in the list; tap a task to read or edit the rest.
- **Steps (subtasks):** break a task into a checklist in the editor. Each finished step adds +3 XP when you complete the task.
- **Repeating tasks:** every day, weekdays, weekends, weekly on chosen days, monthly, yearly, or custom (every N days, weeks or months). Completing one creates the next occurrence; un-completing removes it again.
- **Search and sort:** search titles, descriptions and steps; sort by smart order, due date, priority, newest, or your own order.
- **Drag and drop:** drag a task by its ⋮⋮ handle to reorder it, or onto a category to move it. Works with mouse and touch.
- **Week strip:** the next seven days with a dot per quest due; tap a day to see just those.
- **Weekly challenges:** three new challenges every Monday for bonus XP, shown in the sidebar and the Trophies tab.
- **Theme rewards:** Teal, Pink, Gold and Midnight unlock at levels 3, 5, 8 and 12.
- **Daily reminder:** an optional browser notification at a time you pick, listing what's due. On the web it only fires while Tasko is open in a tab (there's no push server); the iPhone app schedules real notifications.
- **Light / dark / auto:** pick the appearance in Settings; Auto follows your device.
- **Profile:** tap your profile picture (or the person icon as a guest) for XP, tasks done, streaks, a 15-week activity heatmap, tasks by category and your latest trophies.
- **Level milestones:** the Trophies tab shows how much XP is left to the next big levels and what each unlocks.
- **Export:** Settings → Export gives a Todoist import template, a spreadsheet CSV, a Markdown checklist (Things, Notion, Obsidian, Apple Notes) or a full JSON backup.
- **Google Calendar sync:** Settings → Connected apps → Sync now puts every open quest with a due date on your Google Calendar as an all-day event, updates changed ones and removes finished ones. Needs sign-in; see setup below.
- **Keyboard shortcuts:** `N` add, `/` search, `J`/`K` move, `X` complete, `E` edit, `?` all shortcuts.
- **Desktop layout:** on wide screens, progress and categories sit in a sticky sidebar and the task list gets the rest of the width.
- **Color themes:** pick Blue, Orange, Red, Green or Purple under ⚙︎ → Settings (Settings and Trophies are separate tabs). The whole app (backgrounds, buttons, XP bar, confetti) follows it, and it syncs with your account.
- **Categories:** filter with the tabs. Tap ✏️ Edit to rename, change emoji or color, reorder, add or delete categories. Deleting a category keeps its tasks; they become uncategorized.
- **Smart "Today" view:** shows tasks due today or overdue, plus what you finished today.
- **Gamification**
  - XP per task: Low 10, Medium 20, High 35, plus 5 for finishing on or before the due date.
  - Streaks: each consecutive active day adds +5% XP, up to +50%.
  - Daily goal ring (adjustable). Hitting it pays a +25 XP bonus once per day.
  - 100 levels, each with its own rank title (Novice → Questlord), and a level-up celebration.
  - 44 achievements (trophies) for totals, streaks, levels, daily goals, on-time and high-priority work, steps, repeating tasks and weekly challenges.
  - Confetti, floating XP, sounds (can be turned off) and haptics (Android, and the Taptic Engine in the iPhone app).
  - Un-checking a task takes back exactly the XP it earned, so you can't farm XP.
- Optional sign-in with Google, Apple (iPhone app) or email/password, with sync across devices (see above), and in-app account deletion. Without an account, data stays in the browser.
- [Privacy policy](https://alexmaxham.github.io/Claude/privacy.html) (`public/privacy.html`), linked from the sign-in and account screens.
- Undo after deleting a task. Light and dark mode follow the system. Reduced-motion is respected.

## Project layout

```
src/core/        Platform-agnostic logic: types, reducer, XP/levels/streaks, achievements, storage
src/cloud/       Firebase auth + sync (SDK is lazy-loaded; config in config.ts)
src/components/  React (DOM) UI
src/effects.ts   Confetti, sound, haptics
src/native.ts    iPhone app bridge (Capacitor plugins); no-ops on the web
ios/             Xcode project for the iPhone app
src/styles.css   Liquid glass design system
```

`src/core` has no DOM or React imports. All state changes go through the pure `reduce(state, action)` function, which returns the new state plus game events (XP, level up, achievement) for the UI to celebrate.

## iPhone app

`ios/` is a native iPhone app built with [Capacitor](https://capacitorjs.com). It runs this same web build, so it has the identical liquid glass design, and swaps in native pieces where the web falls short:

| | Web | iPhone app |
|---|---|---|
| Haptics | `navigator.vibrate` (Android only) | Taptic Engine: light/medium taps, a success buzz on level up |
| Daily reminder | Only while a tab is open | Real iOS notifications for the next 7 days, even when Tasko is closed |
| Export | File download | Share sheet (Save to Files, AirDrop, Mail…) |
| Saved data | localStorage | localStorage mirrored to native storage, so iOS clearing web data can't lose it |
| Google sign-in | Popup | Native Google sign-in |
| Sign in with Apple | — | Native Apple sign-in |
| Status bar, launch screen, icon | — | Follows light/dark; launch screen and icon from the Tasko logo |

All native calls live in `src/native.ts`; on the web each one is a no-op or falls back to the browser API.

### Build and run (needs a Mac with Xcode 16.3+)

```bash
npm install
npm run ios          # builds the web app, syncs it into ios/, opens Xcode
```

In Xcode: select the **App** target → **Signing & Capabilities** → pick your Team. Sign in with Apple needs a paid Apple Developer Program team; a free personal team can't sign apps with that capability, then choose your iPhone or a simulator and press Run. After changing web code, run `npm run ios:sync` (or `npm run ios` again). Swift packages download on the first build.

The bundle ID is `com.alexmaxham.tasko` (in `capacitor.config.ts` and Xcode). The app is iPhone-only (no iPad build). To publish on the App Store you need an Apple Developer account; then **Product → Archive** in Xcode and upload to TestFlight/App Store Connect. Use `https://alexmaxham.github.io/Claude/privacy.html` as the privacy policy URL.

`npm run ios:assets` re-renders the app icon and launch screen from `public/icon-maskable.svg`. The **iOS build** workflow compiles the app for the simulator on every push.

### Sign-in in the iPhone app

Email/password and Google sign-in both work, and sync with the web app. Google blocks its sign-in page inside apps' web views, so the iPhone app signs in with the native Google SDK, using the Firebase iOS app `com.alexmaxham.tasko`:

- `ios/App/App/GoogleService-Info.plist` is that app's config, from Firebase console → Project settings → Your apps. Like the web config, its values aren't secrets.
- Its `REVERSED_CLIENT_ID` is registered as a URL scheme in `ios/App/App/Info.plist`, so Google can hand control back to Tasko after sign-in.
- `IOS_GOOGLE_SIGN_IN` in `src/cloud/config.ts` turns the native flow on; set it to `false` to offer email sign-in only.

If the Firebase iOS app is ever recreated, download its new **GoogleService-Info.plist** and run `npm run ios:google -- ~/Downloads/GoogleService-Info.plist`. It checks the file is for this app and Firebase project, then updates all three of the above.

Google Calendar sync uses the same native sign-in to ask for calendar access, with the same consent-screen scope as the web (see [Accounts and sync](#accounts-and-sync-firebase)).

**Sign in with Apple** (App Store guideline 4.8 requires it in apps that offer Google sign-in) uses the same native setup, plus:

1. Firebase console → **Authentication → Sign-in method → Add new provider → Apple** → enable. For an iOS-only setup the Services ID fields can stay empty.
2. So that deleting an account also revokes Tasko's access to the user's Apple ID (which Apple requires): in the Apple Developer portal → **Keys**, create a key with *Sign in with Apple* enabled for the App ID `com.alexmaxham.tasko`. Then in Firebase's Apple provider settings, under *OAuth code flow configuration*, enter your Apple Team ID, the Key ID and the downloaded private key.
3. In the Apple Developer portal → **Identifiers → com.alexmaxham.tasko**, make sure *Sign in with Apple* is ticked. Xcode does this automatically when you select a paid team, since the app ships `App/App.entitlements` with the capability.

The Apple button only appears in the iPhone app. Accounts created with it are deleted from the iPhone app, which asks Apple to confirm.
