#!/usr/bin/env bash
set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NasTech EAS Pre-Install"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[PRE-INSTALL] PWD=$(pwd)"

# ─── 1. Download missing app icon / image assets ─────────────────────────────
IMAGES_DIR="sources/assets/images"
BASE_URL="https://raw.githubusercontent.com/nastech-ai/NasTech-Agent/main/NasTech/sources/assets/images"

mkdir -p "$IMAGES_DIR"
echo ""
echo "→ Checking app image assets..."
for img in icon.png icon-adaptive.png icon-monochrome.png icon-notification.png \
           favicon.png splash-android-light.png splash-android-dark.png \
           icon-openclaw.png logotype.png transparent.png; do
  if [ ! -f "$IMAGES_DIR/$img" ]; then
    echo "  Downloading: $img"
    curl -fsSL -o "$IMAGES_DIR/$img" "$BASE_URL/$img" \
      && echo "  ✓ $img ($(wc -c < "$IMAGES_DIR/$img") bytes)" \
      || echo "  ⚠ Failed to download $img"
  else
    echo "  ✓ $img (present)"
  fi
done

# ─── 2. Download Termux bootstrap zips ───────────────────────────────────────
BOOTSTRAP_VERSION="bootstrap-2026.06.14-r1+apt.android-7"
BOOTSTRAP_BASE="https://github.com/termux/termux-packages/releases/download/${BOOTSTRAP_VERSION}"
BOOTSTRAP_DIR="assets/bootstrap"

if [ "${BUNDLE_TERMUX_BOOTSTRAP:-0}" = "1" ]; then
    echo ""
    echo "→ Downloading Termux bootstrap zips..."
    mkdir -p "$BOOTSTRAP_DIR"

    for ARCH in aarch64 arm; do
        ZIP="bootstrap-${ARCH}.zip"
        DEST="$BOOTSTRAP_DIR/$ZIP"
        if [ ! -f "$DEST" ]; then
            echo "  Downloading $ZIP (~29MB)..."
            curl -fsSL --retry 3 "$BOOTSTRAP_BASE/$ZIP" -o "$DEST"
            echo "  ✓ $ZIP ($(du -sh "$DEST" | cut -f1))"
        else
            echo "  ✓ $ZIP already present ($(du -sh "$DEST" | cut -f1))"
        fi
    done
else
    echo ""
    echo "→ Skipping Termux bootstrap (set BUNDLE_TERMUX_BOOTSTRAP=1 to include)"
fi

# ─── 3. Package NasTech Python agent ─────────────────────────────────────────
echo ""
echo "→ Packaging NasTech Python agent..."

ASSETS_DIR="assets"
mkdir -p "$ASSETS_DIR"

# Find agent root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AGENT_SRC=""
for CANDIDATE in \
    "$REPO_ROOT/nastech-agent" \
    "$SCRIPT_DIR/../../nastech-agent" \
    "$REPO_ROOT/../nastech-agent"
do
    if [ -d "$CANDIDATE/nastech_cli" ]; then
        AGENT_SRC="$CANDIDATE"
        break
    fi
done

if [ -n "$AGENT_SRC" ]; then
    echo "  Agent source: $AGENT_SRC"
    AGENT_ZIP="$ASSETS_DIR/nastech-agent.zip"
    (
        cd "$AGENT_SRC"
        FILES=""
        for D in agent nastech_cli providers skills tools gateway cron; do
            [ -d "$D" ] && FILES="$FILES $D"
        done
        for F in run_agent.py pyproject.toml setup.py constraints-termux.txt \
                 nastech_constants.py nastech_logging.py nastech_state.py \
                 nastech_time.py nastech_bootstrap.py toolsets.py utils.py; do
            [ -f "$F" ] && FILES="$FILES $F"
        done
        zip -qr "$AGENT_ZIP" $FILES
    )
    echo "  ✓ nastech-agent.zip ($(du -sh "$AGENT_ZIP" | cut -f1))"
else
    echo "  ⚠ Agent source not found — daemon will download at first run"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pre-install complete ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
