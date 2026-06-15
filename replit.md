# NasDoor

Unified monorepo that merges the NasTech-Agent Python AI daemon with the NasTech Expo SDK 55 mobile app into a single self-contained product called **NasDoor**.

## Architecture

```
/
├── packages/nastech-app/   ← Expo 55 React Native app (EAS)
│   ├── sources/            ← TypeScript source (Expo Router)
│   ├── plugins/            ← withTermuxDaemon.js (Android config plugin)
│   ├── app.config.js       ← Dynamic EAS config
│   └── eas.json            ← EAS build profiles
├── nastech-agent/          ← Python AI daemon (port 9119)
│   ├── nastech_cli/        ← CLI + gateway (web_server.py)
│   └── agent/, providers/, skills/, tools/, ...
└── .github/workflows/
    ├── eas-build.yml       ← EAS Android APK + iOS builds
    └── eas-ota.yml         ← Expo OTA update channel
```

## Platform split

| | Android | iOS |
|---|---|---|
| Daemon | ✓ Termux bootstrap + Python 3 in foreground service | ✗ None |
| UI | Full NasTech app | Connect-to-server screen (`(app)/server.tsx`) |
| Bundle ID | `ba.nastech.ai` | `ai.nastech.ba` |

## Key identifiers

- EAS owner: `nastechai`
- EAS project ID: `925ecdd8-07ba-4775-956b-2b334fab8357`
- Firebase project: `nasdoor-c56bd`
- Android package: `ba.nastech.ai`
- iOS bundle: `ai.nastech.ba`
- GitHub repo: `nastech-ai/NasDoor`

## EAS build

```bash
# Android APK (preview)
eas build --platform android --profile preview

# iOS (preview)
eas build --platform ios --profile preview

# OTA update
eas update --channel production --message "..."
```

## Local dev

```bash
cd packages/nastech-app
pnpm install
pnpm expo start
```

## Secrets required

| Secret | Used for |
|---|---|
| `EXPO_TOKEN` | EAS authentication |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | CI pushes |
| `ELEVENLABS_AGENT_ID` | Voice AI (optional) |
| `LIVEKIT_URL` | LiveKit server (optional) |

## User preferences

- Branding: "Naswif" (not "slopus")
- Default theme: AMOLED Black
- Python daemon Android-only; iOS gets server-connect screen only
