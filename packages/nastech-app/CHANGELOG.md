# NasTech App — Changelog

All notable changes to the NasTech App are documented here.

---

## 1.0.0 — June 2026 — Initial NasDoor release

### What's new

- **On-device Python daemon (Android)** — NasTech Agent runs as a foreground
  service bootstrapped from Termux. No external server needed on Android.
- **14 colour themes** — Super AMOLED Black (default), AMOLED Black, Charcoal,
  Dark, Dark Grey, Steel Grey, Light Grey, Midnight Blue, Dark Blue, Light Blue,
  Dark Green, Dark Purple, Dark Red, Light, and Adaptive.
- **iOS connect screen** — iPhone users can connect to any remote NasTech server
  via Settings → Server Configuration.
- **Daemon status badge** — live indicator showing daemon state
  (setting up / running / restarting / error) with setup progress.
- **EAS build pipeline** — Android APK and iOS builds via GitHub Actions;
  separate pre-install steps so Python bootstrap only runs for Android.
- **OTA updates** — JavaScript-only updates published via Expo Updates.
- **Firebase project** — `nasdoor-c56bd` (Android `ba.nastech.ai`,
  iOS `ai.nastech.ba`).
- **proot + Ubuntu support** — `pkg install proot` wired into daemon bootstrap
  for advanced container use cases on Android.

### Architecture

- Monorepo: `packages/nastech-app` (Expo 55) + `nastech-agent/` (Python daemon)
- Android plugin: `plugins/withTermuxDaemon.js` (Android-only, never touches iOS)
- Daemon bridge: `sources/daemon/` — all methods no-op on iOS via
  `Platform.OS !== 'android'` guards

---

## Pre-release history

Prior to 1.0.0 this codebase was based on an open-source Expo template.
All references to the original project have been replaced with NasTech AI
branding and the codebase has been fully integrated with the NasTech Agent
Python backend.
