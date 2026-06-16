# NasDoor — OpenHands Repository Guide

## Project overview
NasDoor is a monorepo merging the NasTech Expo 55 React Native app with a Python AI daemon.

```
/
├── packages/nastech-app/   ← Expo 55 React Native (iOS + Android)
│   ├── sources/            ← TypeScript source (Expo Router)
│   ├── plugins/withTermuxDaemon.js  ← Android-only config plugin
│   └── app.config.js
├── nastech-agent/          ← Python AI daemon (port 9119, Android only)
└── .github/workflows/      ← 56-Copilot CI/CD fleet
```

## Key identifiers
- EAS owner: `nastechai`, project ID: `925ecdd8-07ba-4775-956b-2b334fab8357`
- Android: `ba.nastech.ai` | iOS: `ai.nastech.ba`
- Python daemon: port 9119, Android only (guarded with `Platform.OS === 'android'`)

## How to fix common CI errors

### TypeScript errors
```bash
cd packages/nastech-app
pnpm install --no-frozen-lockfile
npx tsc --noEmit
```

### Python syntax errors
```bash
cd nastech-agent
python3 -m py_compile <file.py>
autopep8 --in-place -r .
```

### YAML workflow errors
```bash
pip install yamllint
yamllint .github/workflows/ -d relaxed
```

### Expo config errors
```bash
cd packages/nastech-app
APP_ENV=development npx expo config 2>&1
```

## Rules you MUST follow
1. **Never run the Python daemon on iOS** — all daemon code must be inside `Platform.OS === 'android'` guards.
2. **pnpm** is the package manager — do NOT use `npm install` in app code.
3. **EAS builds** go via `eas build --profile preview --platform android`.
4. Secrets: `EXPO_TOKEN` and `GH_PAT` are in GitHub secrets. `LLM_API_KEY` enables OpenHands AI fixes.
5. When fixing CI, prefer small commits with `[skip ci]` to avoid cascading runs.
6. The 56-Copilot fleet: each copilot auto-creates GitHub issues on failures — check issues first.

## Slash commands available
- `/fix <description>` — trigger OpenHands to fix an issue
- `/priority critical` — escalate an issue
- `/status in-progress` — mark issue as being worked on
- `lint-fix` label on PR — auto-fix all lint issues
- `qa-this` label on PR — OpenHands QA validation
