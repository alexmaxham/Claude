# Questlog

A gamified to-do list with a liquid glass look. Built as a web app first, structured so it can become iOS and Android apps later.

**Live app:** https://alexmaxham.github.io/Claude/

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # core logic tests
npm run build     # production build in dist/
```

Every push to the default branch runs the tests, builds, and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Features

- **Quick add:** type and press Enter. Tap ⌄ to set category, priority and due date. Press `N` anywhere to jump to the input.
- **Categories:** filter with the tabs. Tap ✏️ Edit to rename, change emoji or color, reorder, add or delete categories. Deleting a category keeps its tasks; they become uncategorized.
- **Smart "Today" view:** shows tasks due today or overdue, plus what you finished today.
- **Gamification**
  - XP per task: Low 10, Medium 20, High 35, plus 5 for finishing on or before the due date.
  - Streaks: each consecutive active day adds +5% XP, up to +50%.
  - Daily goal ring (adjustable). Hitting it pays a +25 XP bonus once per day.
  - Levels with a new rank title at each level, and a level-up celebration.
  - 15 achievements (trophies).
  - Confetti, floating XP, sounds (can be turned off) and haptics on Android.
  - Un-checking a task takes back exactly the XP it earned, so you can't farm XP.
- Undo after deleting a task. Light and dark mode follow the system. Reduced-motion is respected. Data is saved locally in the browser.

## Project layout

```
src/core/        Platform-agnostic logic: types, reducer, XP/levels/streaks, achievements, storage
src/components/  React (DOM) UI
src/effects.ts   Confetti, sound, haptics
src/styles.css   Liquid glass design system
```

`src/core` has no DOM or React imports. All state changes go through the pure `reduce(state, action)` function, which returns the new state plus game events (XP, level up, achievement) for the UI to celebrate.

## Going mobile later

There are two paths:

1. **Capacitor (fastest).** Wrap this web app as-is in native iOS/Android shells. Swap `localStorage` for Capacitor Preferences using the `KeyValueStore` interface in `src/core/storage.ts`, and use `@capacitor/haptics` in `effects.ts`.
2. **React Native / Expo (most native feel).** Reuse `src/core` unchanged and rebuild the components with RN primitives. iOS 26+ also offers native Liquid Glass materials there.
