<div align="center">
  <h1>🚪 NasDoor</h1>
  <p><strong>Self-contained AI assistant that runs entirely on your Android device.</strong><br/>
  No cloud required. No subscriptions. Your data stays on your hardware.</p>
</div>

<div align="center">

[![EAS Build](https://github.com/nastech-ai/NasDoor/actions/workflows/eas-build.yml/badge.svg)](https://github.com/nastech-ai/NasDoor/actions/workflows/eas-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![EAS](https://img.shields.io/badge/EAS-nastechai-purple)](https://expo.dev/@nastechai/nastech-agent)

</div>

---

## What is NasDoor?

NasDoor ships two tightly integrated components as a single product:

| Component | Description |
|---|---|
| **NasTech App** | React Native (Expo 55) mobile UI — Android + iOS |
| **NasTech Agent** | Python AI daemon running fully on-device (Android via Termux + proot) |

**Android** — the app bootstraps a full Python 3 environment via Termux and runs the AI daemon (port 9119) as a persistent foreground service. No external server needed.

**iOS** — the app connects to a remote NasTech server you run on a Mac, Linux box, or Android phone.

---

## Repository layout

```
NasDoor/
├── packages/nastech-app/      ← Expo 55 React Native app
│   ├── sources/               ← TypeScript source (Expo Router)
│   ├── plugins/               ← withTermuxDaemon.js (Android-only config plugin)
│   ├── app.config.js          ← Dynamic EAS build config
│   └── eas.json               ← EAS build profiles
├── nastech-agent/             ← Python AI daemon (port 9119)
│   ├── nastech_cli/           ← CLI + REST/WebSocket gateway
│   ├── agent/                 ← Core agent logic
│   ├── providers/             ← LLM provider adapters (Anthropic, OpenAI, …)
│   ├── skills/                ← Agent skill library
│   └── tools/                 ← Tool implementations
└── .github/workflows/
    ├── eas-build.yml          ← EAS Android APK + iOS build
    ├── eas-ota.yml            ← Expo OTA JavaScript update
    ├── typecheck.yml          ← TypeScript type-checking
    ├── agent-smoke-test.yml   ← Python daemon smoke test
    └── repo-meta.yml          ← GitHub repo metadata auto-update
```

---

## Platform matrix

| Feature | Android | iOS |
|---|---|---|
| AI daemon | ✅ On-device (Termux + Python 3 + proot) | ❌ Connect to remote server |
| Full chat UI | ✅ | ✅ |
| Push notifications | ✅ | ✅ |
| Voice (LiveKit) | ✅ | ✅ |
| OTA JS updates | ✅ | ✅ |
| Bundle ID | `ba.nastech.ai` | `ai.nastech.ba` |

---

## Build

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [pnpm 10+](https://pnpm.io)
- [EAS CLI](https://docs.expo.dev/eas/) — `npm install -g eas-cli`
- EAS account under `nastechai` with `EXPO_TOKEN` set

### Android APK

```bash
eas build --platform android --profile preview
```

### iOS

```bash
eas build --platform ios --profile preview
```

### OTA JavaScript update

```bash
eas update --channel preview --message "describe the change"
```

### Local development

```bash
cd packages/nastech-app
pnpm install
pnpm expo start
```

### Python daemon (local)

```bash
cd nastech-agent
pip install -e ".[dev]"
python3 -m nastech_cli.main gateway start
# API available at http://127.0.0.1:9119
```

---

## Colour themes

14 built-in themes, grouped by family:

| Family | Themes |
|---|---|
| **Black** | Super AMOLED Black *(default)*, AMOLED Black, Charcoal, Dark |
| **Grey** | Dark Grey, Steel Grey, Light Grey |
| **Blue** | Midnight Blue, Dark Blue, Light Blue |
| **Colour** | Dark Green, Dark Purple, Dark Red |
| **Light** | Light, Adaptive |

---

## Key identifiers

| | |
|---|---|
| EAS owner | `nastechai` |
| EAS project ID | `925ecdd8-07ba-4775-956b-2b334fab8357` |
| Firebase project | `nasdoor-c56bd` |
| Android package | `ba.nastech.ai` |
| iOS bundle | `ai.nastech.ba` |
| GitHub repo | `nastech-ai/NasDoor` |

---

## Required secrets

| Secret | Purpose |
|---|---|
| `EXPO_TOKEN` | EAS authentication |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | CI pushes + repo metadata bot |
| `ELEVENLABS_AGENT_ID` | Voice AI *(optional)* |
| `LIVEKIT_URL` | LiveKit voice server *(optional)* |

---

## License

MIT — © 2026 NasTech AI. See [LICENSE](LICENSE).
