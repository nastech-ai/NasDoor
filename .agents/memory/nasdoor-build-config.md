---
name: NasDoor build config
description: EAS owner, Firebase project, bundle IDs (iOS != Android), EAS project ID
---

# NasDoor Build Config

**Why:** iOS and Android have different Firebase app registrations so their bundle IDs differ.

## Identifiers
- EAS owner: `nastechai`
- EAS project ID: `925ecdd8-07ba-4775-956b-2b334fab8357`
- Firebase project: `nasdoor-c56bd`
- iOS bundle ID: `ai.nastech.ba` (GoogleService-Info.plist BUNDLE_ID)
- Android package: `ba.nastech.ai` (google-services.json package_name)
- GitHub repo: `nastech-ai/NasDoor`

## How to apply
In `app.config.js`, use separate `iosBundleId` and `androidPackage` variables (not a single `bundleId`).
Set `ios.bundleIdentifier` and `android.package` independently.

## Termux bootstrap
Version: `bootstrap-2026.06.14-r1+apt.android-7`
Downloaded at EAS build time via `BUNDLE_TERMUX_BOOTSTRAP=1` env var (Android builds only).
Pre-install script guards on `EAS_BUILD_PLATFORM === 'android'`.
