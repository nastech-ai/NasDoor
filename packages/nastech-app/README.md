# NasTech App

React Native (Expo 55) mobile client for the NasTech AI platform.

## Architecture

| Layer | Description |
|---|---|
| **Mobile UI** | React Native + Expo Router (iOS / Android) |
| **API bridge** | `sources/sync/nastechApi.ts` — REST + WebSocket |
| **Daemon bridge** | `sources/daemon/` — Android-only native module |
| **Server config** | `sources/sync/serverConfig.ts` — default `http://127.0.0.1:9119` |
| **Auth** | Bearer token via `Authorization: Bearer <session-token>` |

## Platform behaviour

### Android
- App starts the NasTech Python daemon as a foreground service on boot
- Termux bootstrap (aarch64 / arm) extracted to internal storage on first run
- Python agent installed from bundled `nastech-agent.zip`
- Daemon auto-restarts if it crashes

### iOS
- No Python daemon — connects to a remote NasTech server instead
- Server URL configured via **Settings → Server Configuration**

## Backend API contract

```
NasTech App ──HTTP/WS──► http://127.0.0.1:9119  (Android local)
                          ──HTTP/WS──► https://<your-server>:9119  (iOS remote)

GET  /api/status              → server health + version
GET  /api/sessions            → session list
GET  /api/sessions/:id/messages
DELETE /api/sessions/:id
WS   /api/events?channel=…   → real-time event stream
```

## Local dev

```bash
pnpm install
pnpm expo start

# Android with daemon
pnpm expo run:android

# iOS (simulator)
pnpm expo run:ios
```

## EAS builds

```bash
# Android APK
eas build --platform android --profile preview

# iOS
eas build --platform ios --profile preview

# OTA update
eas update --channel preview --message "..."
```

## Colour themes

14 themes in 5 families — see `sources/theme.ts`.  
Default: **Super AMOLED Black**.

## Key files

| File | Purpose |
|---|---|
| `app.config.js` | Dynamic EAS config (bundle IDs, permissions, plugins) |
| `eas.json` | EAS build profiles |
| `eas-build-pre-install.sh` | Pre-build script (images, Termux bootstrap, agent zip) |
| `plugins/withTermuxDaemon.js` | Android-only Expo config plugin |
| `sources/daemon/` | TypeScript daemon bridge (Android only) |
| `sources/app/(app)/server.tsx` | iOS server configuration screen |
| `sources/theme.ts` | All 14 colour themes |
| `sources/unistyles.ts` | Theme registration + `THEME_NAMES` export |

## License

MIT — © 2026 NasTech AI
