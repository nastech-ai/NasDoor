---
name: NasDoor daemon iOS rule
description: Python daemon is strictly Android-only; iOS shows server-connect screen
---

# NasDoor iOS Rule: No Python

**Why:** User requirement — iOS must not include Python, Termux bootstrap, or daemon code.

## How to apply
- `NativeDaemon.ts`: all methods guard on `const isAndroid = Platform.OS === 'android'`
- `DaemonManager.ts`: `initDaemon()` returns immediately if `Platform.OS !== 'android'`
- `withTermuxDaemon.js`: plugin only uses `withAndroidManifest` + `withDangerousMod(['android', ...])` + `withMainApplication` — all Android-only APIs
- `eas-build-pre-install.sh`: skips bootstrap download/agent zip when `EAS_BUILD_PLATFORM !== 'android'`
- iOS entry point: `sources/app/(app)/server.tsx` — server connection screen (registered in `(app)/_layout.tsx` as `"server"`)
- The top-level `sources/app/server.tsx` was removed (duplicate) — use `(app)/server.tsx`
