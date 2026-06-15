# NasTech App

A React Native / Expo mobile application for interacting with a self-hosted **NasTech Agent** backend.
Built on top of the open-source the original open-source app project, fully rebranded and wired to the NasTech system.

## Architecture

| Layer | Description |
|-------|-------------|
| **Mobile UI** | React Native + Expo (iOS / Android / macOS via Tauri) |
| **API bridge** | `sources/sync/nastechApi.ts` — REST + WebSocket client |
| **Wire types** | `sources/wire/index.ts` → NasTech-owned schemas in `sources/nastech-wire/` |
| **Server config** | `sources/sync/serverConfig.ts` — default `http://127.0.0.1:9119` |
| **Auth** | Bearer token via `Authorization: Bearer <session-token>` |

## Wiring to NasTech Backend

The app connects to the NasTech Agent dashboard backend (`nastech_cli/web_server.py`):

```
NasTech App ──HTTP/WS──► http://127.0.0.1:9119
                          ├── GET  /api/status          (server probe)
                          ├── GET  /api/sessions         (session list)
                          ├── GET  /api/sessions/:id/messages
                          ├── DELETE /api/sessions/:id
                          └── WS   /api/events?channel=… (real-time)
```

### Auth modes
- **Insecure** (local): `python3 -m nastech_cli.main dashboard --insecure` — no token required
- **Secure**: pass `Authorization: Bearer <session-token>` — set the token in-app via Settings → Server

## Getting Started

```bash
cd NasTech
pnpm install
pnpm start            # Expo dev server
pnpm ios              # Run on iOS simulator
pnpm android          # Run on Android emulator
pnpm web              # Run in browser
```

Set the server URL (defaults to `http://127.0.0.1:9119`):
- In-app: Settings → Server
- Env: `EXPO_PUBLIC_NASTECH_SERVER_URL=http://your-server:9119`

## Key Source Files

| File | Purpose |
|------|---------|
| `sources/sync/nastechApi.ts` | NasTech REST + WebSocket API client |
| `sources/sync/serverConfig.ts` | Server URL + log URL storage |
| `sources/wire/index.ts` | Wire type re-exports |
| `sources/hooks/useNasTechAction.ts` | Error-handling async action hook |
| `sources/sync/apiSocket.ts` | Real-time socket connection |
| `sources/utils/errors.ts` | NasTechError type |

## App Config

| Variant | Bundle ID | Name |
|---------|-----------|------|
| development | `com.nastech.app.dev` | NasTech (dev) |
| preview | `com.nastech.app.preview` | NasTech (preview) |
| production | `com.nastech.app` | NasTech |

## Notes

- Encryption key derivation strings (the upstream crypto salts, etc.) in
  `sources/sync/encryption/` are **intentionally left unchanged** — they are
  cryptographic key derivation salts and must remain stable to avoid breaking
  decryption of existing data.
- Wire protocol schemas are fully owned in `sources/nastech-wire/` with no external wire dependency.
- Test fixture data in `sources/sync/__testdata__/` may still reference original
  paths — these are static replay traces and do not affect runtime behavior.
