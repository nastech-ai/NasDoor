#!/usr/bin/env bash
# NasTech EAS Pre-Install Script
# Runs on the EAS/CI build machine BEFORE npm install.
# Target: Android 14+, 8 GB RAM, 30 GB storage.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NasTech EAS Pre-Install"
echo "  Platform : ${EAS_BUILD_PLATFORM:-unknown}"
echo "  Script   : $SCRIPT_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. App image assets ───────────────────────────────────────────────────────
IMAGES_DIR="$SCRIPT_DIR/sources/assets/images"
BASE_URL="https://raw.githubusercontent.com/nastech-ai/NasDoor/main/packages/nastech-app/sources/assets/images"

mkdir -p "$IMAGES_DIR"
echo ""
echo "→ Checking app image assets..."
for img in \
    icon.png icon-adaptive.png icon-monochrome.png icon-notification.png \
    favicon.png splash-android-light.png splash-android-dark.png \
    icon-openclaw.png logotype.png transparent.png; do
  DEST="$IMAGES_DIR/$img"
  if [ ! -f "$DEST" ] || [ ! -s "$DEST" ]; then
    echo "  Downloading: $img"
    curl -fsSL --retry 3 -o "$DEST" "$BASE_URL/$img" \
      && echo "    ✓ $img" \
      || { echo "    ⚠ Failed: $img (creating placeholder)"; printf '\x89PNG\r\n' > "$DEST"; }
  else
    echo "  ✓ $img (present)"
  fi
done

# ─── 2. Android-only: Termux bootstrap + Python agent ─────────────────────────
PLATFORM="${EAS_BUILD_PLATFORM:-}"

if [ "$PLATFORM" = "android" ] || [ "${FORCE_ANDROID_ASSETS:-0}" = "1" ]; then
    ASSETS_DIR="$SCRIPT_DIR/assets"
    BOOTSTRAP_DIR="$ASSETS_DIR/bootstrap"

    # Bootstrap version matching DaemonService.java constant
    BOOTSTRAP_VERSION="bootstrap-2026.06.14-r1+apt.android-7"
    BOOTSTRAP_BASE="https://github.com/termux/termux-packages/releases/download/${BOOTSTRAP_VERSION}"

    mkdir -p "$BOOTSTRAP_DIR"
    mkdir -p "$ASSETS_DIR"

    # Always bundle bootstrap for Android — target is high-end devices (8 GB RAM / 30 GB).
    # Download all three architectures: aarch64 (arm64), arm (32-bit), x86_64.
    echo ""
    echo "→ Downloading Termux bootstrap zips (Android 14+, all supported ABIs)..."
    for ARCH in aarch64 arm x86_64; do
        ZIP="bootstrap-${ARCH}.zip"
        DEST="$BOOTSTRAP_DIR/$ZIP"
        if [ -f "$DEST" ] && [ -s "$DEST" ]; then
            SIZE=$(du -sh "$DEST" 2>/dev/null | cut -f1 || echo "?")
            echo "  ✓ $ZIP (cached, $SIZE)"
        else
            echo "  Downloading $ZIP..."
            if curl -fsSL --retry 3 --retry-delay 5 \
                   "$BOOTSTRAP_BASE/$ZIP" -o "$DEST"; then
                SIZE=$(du -sh "$DEST" 2>/dev/null | cut -f1 || echo "?")
                echo "  ✓ $ZIP ($SIZE)"
            else
                echo "  ⚠ Failed to download $ZIP — daemon will download on first run for $ARCH devices"
                rm -f "$DEST"
            fi
        fi
    done

    # ── Python agent zip ────────────────────────────────────────────────────────
    echo ""
    echo "→ Packaging NasTech Python agent..."

    REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    AGENT_SRC=""
    for CANDIDATE in \
        "$REPO_ROOT/nastech-agent" \
        "$REPO_ROOT/../nastech-agent"; do
        if [ -d "$CANDIDATE/nastech_cli" ]; then
            AGENT_SRC="$CANDIDATE"
            break
        fi
    done

    AGENT_ZIP="$ASSETS_DIR/nastech-agent.zip"

    if [ -n "$AGENT_SRC" ]; then
        echo "  Agent source: $AGENT_SRC"

        # Collect dirs and files to include
        FILES=""
        for D in agent nastech_cli providers skills tools gateway cron utils; do
            [ -d "$AGENT_SRC/$D" ] && FILES="$FILES $D"
        done
        for F in \
            run_agent.py pyproject.toml setup.py \
            constraints-termux.txt \
            nastech_constants.py nastech_logging.py nastech_state.py \
            nastech_time.py nastech_bootstrap.py toolsets.py utils.py; do
            [ -f "$AGENT_SRC/$F" ] && FILES="$FILES $F"
        done

        if [ -n "$FILES" ]; then
            (
              cd "$AGENT_SRC"
              if command -v zip >/dev/null 2>&1; then
                zip -qr "$AGENT_ZIP" $FILES
              else
                python3 -c "
import zipfile, os, sys
files = sys.argv[1:]
with zipfile.ZipFile('$AGENT_ZIP', 'w', zipfile.ZIP_DEFLATED) as zf:
    for item in files:
        if os.path.isdir(item):
            for root, dirs, fnames in os.walk(item):
                # Skip __pycache__ and .pyc to reduce size
                dirs[:] = [d for d in dirs if d != '__pycache__']
                for fname in fnames:
                    if not fname.endswith('.pyc'):
                        zf.write(os.path.join(root, fname))
        elif os.path.isfile(item):
            zf.write(item)
" $FILES
              fi
            )
            SIZE=$(du -sh "$AGENT_ZIP" 2>/dev/null | cut -f1 || echo "?")
            echo "  ✓ nastech-agent.zip ($SIZE)"
        else
            echo "  ⚠ No agent files found to zip"
        fi
    else
        echo "  ⚠ Agent source not found — daemon will download on first run"
    fi
else
    echo ""
    echo "→ iOS build — skipping Termux bootstrap and Python agent (Android-only)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pre-install complete ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
