#!/usr/bin/env bash
set -euo pipefail

# Resolve absolute path of this script's directory (packages/nastech-app)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NasTech EAS Pre-Install"
echo "  Platform : ${EAS_BUILD_PLATFORM:-unknown}"
echo "  Script   : $SCRIPT_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. App icon / image assets ──────────────────────────────────────────────
IMAGES_DIR="$SCRIPT_DIR/sources/assets/images"
BASE_URL="https://raw.githubusercontent.com/nastech-ai/NasDoor/main/packages/nastech-app/sources/assets/images"

mkdir -p "$IMAGES_DIR"
echo ""
echo "→ Checking app image assets..."
for img in icon.png icon-adaptive.png icon-monochrome.png icon-notification.png \
           favicon.png splash-android-light.png splash-android-dark.png \
           icon-openclaw.png logotype.png transparent.png; do
  DEST="$IMAGES_DIR/$img"
  if [ ! -f "$DEST" ] || [ ! -s "$DEST" ]; then
    echo "  Downloading: $img"
    curl -fsSL --retry 3 -o "$DEST" "$BASE_URL/$img" \
      && echo "  ✓ $img" \
      || { echo "  ⚠ Failed: $img (creating placeholder)"; printf 'PNG' > "$DEST"; }
  else
    echo "  ✓ $img (present)"
  fi
done

# ─── 2. Android-only: Termux bootstrap + Python agent ────────────────────────
# iOS builds skip this entirely — no Python, no bootstrap, no daemon.
PLATFORM="${EAS_BUILD_PLATFORM:-}"

if [ "$PLATFORM" = "android" ] || [ "${FORCE_ANDROID_ASSETS:-0}" = "1" ]; then
    ASSETS_DIR="$SCRIPT_DIR/assets"
    BOOTSTRAP_DIR="$ASSETS_DIR/bootstrap"
    BOOTSTRAP_VERSION="bootstrap-2026.06.14-r1+apt.android-7"
    BOOTSTRAP_BASE="https://github.com/termux/termux-packages/releases/download/${BOOTSTRAP_VERSION}"

    mkdir -p "$BOOTSTRAP_DIR"
    mkdir -p "$ASSETS_DIR"

    if [ "${BUNDLE_TERMUX_BOOTSTRAP:-0}" = "1" ]; then
        echo ""
        echo "→ Downloading Termux bootstrap zips (Android only)..."
        for ARCH in aarch64 arm; do
            ZIP="bootstrap-${ARCH}.zip"
            DEST="$BOOTSTRAP_DIR/$ZIP"
            if [ ! -f "$DEST" ] || [ ! -s "$DEST" ]; then
                echo "  Downloading $ZIP (~29MB)..."
                curl -fsSL --retry 3 "$BOOTSTRAP_BASE/$ZIP" -o "$DEST"
                SIZE=$(du -sh "$DEST" | cut -f1)
                echo "  ✓ $ZIP ($SIZE)"
            else
                SIZE=$(du -sh "$DEST" | cut -f1)
                echo "  ✓ $ZIP (cached, $SIZE)"
            fi
        done
    fi

    echo ""
    echo "→ Packaging NasTech Python agent (Android only)..."

    # Find nastech-agent source relative to repo root
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

    AGENT_ZIP="$ASSETS_DIR/nastech-agent.zip"   # ABSOLUTE path — safe inside subshells

    if [ -n "$AGENT_SRC" ]; then
        echo "  Agent source: $AGENT_SRC"
        # Collect files to zip
        FILES=""
        for D in agent nastech_cli providers skills tools gateway cron; do
            [ -d "$AGENT_SRC/$D" ] && FILES="$FILES $D"
        done
        for F in run_agent.py pyproject.toml setup.py constraints-termux.txt \
                 nastech_constants.py nastech_logging.py nastech_state.py \
                 nastech_time.py nastech_bootstrap.py toolsets.py utils.py; do
            [ -f "$AGENT_SRC/$F" ] && FILES="$FILES $F"
        done

        if [ -n "$FILES" ]; then
            # cd into agent dir for relative paths inside zip, output to absolute path
            if command -v zip >/dev/null 2>&1; then
                (cd "$AGENT_SRC" && zip -qr "$AGENT_ZIP" $FILES)
            else
                # Fallback: use Python's zipfile module (always available)
                (cd "$AGENT_SRC" && python3 -c "
import zipfile, os, sys
files = sys.argv[1:]
with zipfile.ZipFile('$AGENT_ZIP', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root_item in files:
        if os.path.isdir(root_item):
            for root, dirs, fnames in os.walk(root_item):
                for fname in fnames:
                    fp = os.path.join(root, fname)
                    zf.write(fp)
        elif os.path.isfile(root_item):
            zf.write(root_item)
" $FILES)
            fi
            SIZE=$(du -sh "$AGENT_ZIP" | cut -f1)
            echo "  ✓ nastech-agent.zip ($SIZE)"
        else
            echo "  ⚠ No agent files found in $AGENT_SRC"
        fi
    else
        echo "  ⚠ Agent source not found — daemon will download on first run"
        echo "  (checked: $REPO_ROOT/nastech-agent)"
    fi
else
    echo ""
    echo "→ iOS build — skipping Termux bootstrap and Python agent (not needed)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pre-install complete ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
