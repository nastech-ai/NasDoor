# NasTech Expo App — Agent Safety Guide

> **Read this entire file before touching anything in `NasTech/`.**
> Every rule below was learned from a real build failure. Violating any one
> of them will silently break EAS cloud builds even if the app runs fine locally.

---

## 1. What this project is

The `NasTech/` directory is an **Expo SDK 55** React Native app that lives inside
the larger `nastech-ai/NasTech-Agent` monorepo. It is built and distributed as an
Android APK (and iOS IPA) via **EAS Build** (Expo Application Services).

```
nastech-ai/NasTech-Agent/   ← git root
├── NasTech/                ← THIS project (Expo app)
│   ├── app.config.js
│   ├── eas.json
│   ├── package.json
│   ├── .easignore
│   ├── plugins/
│   │   └── withEinkCompatibility.js
│   └── sources/
│       ├── app/            ← expo-router file-based routes
│       ├── assets/
│       │   └── images/     ← ALL app icons and splash images live here
│       └── ...
├── .gitignore              ← REPO ROOT gitignore — rules here affect EAS
├── .github/
│   └── workflows/
│       └── eas-build-android.yml
└── ...
```

---

## 2. How EAS builds work (critical mental model)

EAS CLI does **not** archive from the `NasTech/` directory alone. It reads the
nearest `.git` folder (which is at the repo root), then archives the **entire
git repository** respecting both `.gitignore` and `.easignore`.

The archive is extracted on the EAS server to:
```
/home/expo/workingdir/build/
```
So the Expo project root on EAS is:
```
/home/expo/workingdir/build/NasTech/
```

**Consequence:** Any `.gitignore` pattern in the repo root that matches a path
inside `NasTech/` will cause those files to be **silently absent** on the EAS
server — even if the files are committed to git and visible in GitHub.

---

## 3. The `.gitignore` trap — NEVER add broad patterns

The repo-root `.gitignore` already contains patterns. If you add a new pattern,
check whether it could accidentally match something inside `NasTech/`.

**WRONG** — matches `NasTech/sources/assets/images/` and strips images from EAS:
```
images/
```

**CORRECT** — anchored to repo root only, does not affect NasTech:
```
/images/
```

**Rule:** When adding a gitignore pattern that refers to a generic directory
name (e.g. `data/`, `logs/`, `tmp/`, `images/`, `assets/`), **always anchor
it with a leading `/`** unless you explicitly want it to apply at every depth.

---

## 4. Image and asset paths in `app.config.js` — RELATIVE ONLY

`app.config.js` configures all app icons, splash screens, and favicons.

**WRONG — absolute path via `path.resolve`:**
```js
// Breaks on EAS because __dirname resolves differently on their servers
icon: path.resolve(__dirname, 'sources/assets/images/icon.png'),
```

**CORRECT — relative path from project root:**
```js
icon: './sources/assets/images/icon.png',
```

Expo's config system resolves `./...` paths from the project root
(`NasTech/`) on every platform. Relative paths are portable; absolute paths
built with `path.resolve(__dirname, ...)` are fragile and will break if the
project is ever evaluated from a different working directory.

**All image-referencing fields that must use relative paths:**
- `expo.icon`
- `expo.android.adaptiveIcon.foregroundImage`
- `expo.android.adaptiveIcon.monochromeImage`
- `expo.web.favicon`
- Inside `plugins` arrays: `expo-notifications` icon, `expo-splash-screen`
  image references

**Do NOT add `const path = require('node:path')` or use `__dirname`** for
asset paths. It is fine to use `path` for non-asset logic (e.g. git commands).

---

## 5. `withEinkCompatibility.js` — the lazy-require rule

`NasTech/plugins/withEinkCompatibility.js` is a config plugin. It **must**
lazy-require `expo/config-plugins` **inside the plugin function body**, not at
the top of the file:

**WRONG — top-level require:**
```js
const { withAndroidManifest } = require('expo/config-plugins'); // ← breaks EAS
const withEinkCompatibility = (config, options = {}) => { ... };
```

**CORRECT — lazy require inside function:**
```js
const withEinkCompatibility = (config, options = {}) => {
  const { withAndroidManifest } = require('expo/config-plugins'); // ← safe
  ...
};
```

**Why:** EAS evaluates `app.config.js` (and therefore loads all plugins listed
in it) **before** running `pnpm install`. If `expo/config-plugins` is required
at module load time, the require fails because `node_modules` doesn't exist yet.
Lazy-requiring it inside the function body defers the require until `expo prebuild`
actually runs the plugin, at which point `node_modules` is present.

---

## 6. `.easignore` — what is excluded from the EAS archive

`NasTech/.easignore` tells EAS which files/directories to strip before uploading.
Current contents:
```
node_modules/
.node_modules_bak/
android/
ios/
.git/
*.keystore
credentials.json
__tests__/
coverage/
.expo/
dist/
build/
```

**Do not add `sources/` or `sources/assets/` or `images/` to `.easignore`.**
Those paths contain app source code and required image assets.

---

## 7. Package manager — pnpm v10

The project uses `pnpm@10.11.0` (set in `package.json` `packageManager` field).

```json
"packageManager": "pnpm@10.11.0"
```

**pnpm v10 changed default behavior:** it no longer runs build scripts for
packages that are not explicitly allow-listed. If you add a native module that
requires a build step (e.g. `esbuild`, packages with `install.js` scripts), you
must add it to `pnpm.onlyBuiltDependencies` in `package.json`:

```json
"pnpm": {
  "overrides": { "react": "19.2.0" },
  "onlyBuiltDependencies": ["esbuild", "@shopify/react-native-skia", "your-new-package"]
}
```

Run `pnpm install` after any change to `package.json`.

---

## 8. Expo SDK 55 — package version discipline

All `expo-*` packages must be pinned to `~55.x.x`. Do **not** upgrade any
individual `expo-*` package to a higher major version without upgrading the
entire SDK.

Before adding or upgrading any package, run:
```bash
cd NasTech && npx expo install --check
```
This validates that all Expo-managed packages are on the correct SDK 55 range.

**Do not run `expo upgrade`** unless intentionally migrating the entire SDK.

---

## 9. Local prebuild verification — run this before every push

After any change to `app.config.js`, `plugins/`, or `NasTech/package.json`:

```bash
cd NasTech
npx expo prebuild --platform android --clean
```

A successful run ends with:
```
✅ E-ink compatibility plugin applied successfully
✔ Finished prebuild
```

If prebuild fails locally, **do not push**. Fix it first.

---

## 10. How to push changes (git CLI is blocked in the Replit main agent)

Changes must be pushed via the **GitHub REST API** using the
`GITHUB_PERSONAL_ACCESS_TOKEN` secret. The repo is `nastech-ai/NasTech-Agent`.

**Step-by-step:**

1. Get the current file SHA from GitHub (needed for updates):
```bash
curl -s -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
  "https://api.github.com/repos/nastech-ai/NasTech-Agent/contents/NasTech/app.config.js" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])"
```

2. Base64-encode the new file content:
```bash
BASE64=$(base64 -w 0 NasTech/app.config.js)
```

3. Push via PUT:
```bash
curl -s -X PUT \
  -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/nastech-ai/NasTech-Agent/contents/NasTech/app.config.js" \
  -d "{\"message\": \"fix: describe change here\", \"content\": \"$BASE64\", \"sha\": \"<SHA_FROM_STEP_1>\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('commit:', d.get('commit',{}).get('sha','ERROR'))"
```

A successful push prints a commit SHA.

---

## 11. EAS build — triggering and monitoring

Builds are triggered via the GitHub Actions workflow at
`.github/workflows/eas-build-android.yml`.

**Trigger a new build:**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/nastech-ai/NasTech-Agent/actions/workflows/eas-build-android.yml/dispatches" \
  -d '{"ref":"main"}'
```

**Check status:**
```bash
curl -s -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
  "https://api.github.com/repos/nastech-ai/NasTech-Agent/actions/runs?per_page=5" \
  | python3 -c "
import sys,json
runs = json.load(sys.stdin).get('workflow_runs',[])
for r in runs:
    print(r['id'], r['status'], r['conclusion'] or 'pending', r['head_sha'][:8], r['name'])
"
```

**Get logs of a failed run** (replace RUN_ID):
```bash
curl -s -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
  "https://api.github.com/repos/nastech-ai/NasTech-Agent/actions/runs/RUN_ID/logs" \
  -L -o /tmp/eas_logs.zip

python3 -c "
import zipfile
with zipfile.ZipFile('/tmp/eas_logs.zip') as z:
    content = z.read('EAS Android preview build/7_Build Android APK.txt').decode('utf-8', errors='replace')
    for i, line in enumerate(content.split('\n')):
        if any(x in line for x in ['Error', 'ENOENT', 'failed', '✖']):
            print(f'line {i}: {line}')
"
```

**EAS account:** `nastechai2` · **projectId:** `0a7f820d-0e70-4fb9-aba7-0701324e0975`
**Build profiles:** `preview` (default), `production`, `development`

**Free plan limit:** The `nastechai2` account has a monthly EAS build quota.
If a build fails with *"This account has used its Android builds from the Free plan
this month"*, this is a quota error — **not a code error**. The quota resets on
the 1st of each month. No code changes are needed.

---

## 12. EAS binary log format

EAS build logs downloaded from the EAS dashboard are in a proprietary binary
format (not gzip, zlib, lzma, bz2, or zstd). **Do not attempt to decompress
them.** The only readable logs come from:
- GitHub Actions step logs (method above)
- Text pasted directly from the EAS build dashboard UI

---

## 13. Build profiles (`eas.json`)

| Profile | Distribution | Channel | APK type |
|---|---|---|---|
| `preview` | internal (sideload) | preview | signed APK |
| `production` | store | production | signed AAB |
| `development` | internal | development | debug with dev client |

The `SHARP_IGNORE_GLOBAL_LIBVIPS=1` env var is set in every profile — do not
remove it; it prevents sharp (image processing) from conflicting with the EAS
build image's system libvips.

---

## 14. `sources/assets/images/` — the canonical image directory

All app icon and splash image files live at:
```
NasTech/sources/assets/images/
```

| File | Purpose |
|---|---|
| `icon.png` | Main app icon (1024×1024 RGBA PNG) |
| `icon-adaptive.png` | Android adaptive icon foreground (1024×1024 RGBA PNG) |
| `icon-monochrome.png` | Android monochrome/themed icon (1024×1024 RGBA PNG) |
| `icon-notification.png` | Android notification icon |
| `icon-openclaw.png` | Alt brand icon |
| `splash-android-light.png` | Android light-mode splash |
| `splash-android-dark.png` | Android dark-mode splash |
| `favicon.png` | Web favicon |
| `transparent.png` | Transparent placeholder |
| `logotype.png` | Text logotype |

These files ARE tracked in git and ARE in GitHub. If a new EAS build reports
them missing, the most likely cause is a new `.gitignore` pattern at the repo
root that matches `images/` without a leading `/`. Fix: anchor it as `/images/`.

---

## 15. Forbidden actions checklist

Before pushing any change, verify you have NOT done any of the following:

- [ ] Added `path.resolve(__dirname, ...)` to any image path in `app.config.js`
- [ ] Added `require('expo/config-plugins')` at the top level of any plugin file
- [ ] Added an un-anchored pattern like `images/` or `assets/` to the root `.gitignore`
- [ ] Added `sources/`, `sources/assets/`, or any image directory to `.easignore`
- [ ] Upgraded an `expo-*` package beyond SDK 55 range (`~55.x.x`)
- [ ] Changed `packageManager` away from `pnpm@10.11.0`
- [ ] Added a native module that requires a build script without listing it in
      `pnpm.onlyBuiltDependencies`
- [ ] Skipped running `npx expo prebuild --platform android --clean` after config changes

---

## 16. Quick-start checklist for any new change

1. **Read** this file
2. Make your change
3. Run `cd NasTech && npx expo prebuild --platform android --clean`
4. Confirm it ends with `✔ Finished prebuild`
5. Push via GitHub REST API (section 10)
6. Trigger EAS build (section 11)
7. Monitor GitHub Actions for the step-level result
