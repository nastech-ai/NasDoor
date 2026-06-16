#!/bin/bash
# NasDoor — GitHub Actions self-hosted runner
# Self-installing inside persistent workspace. Loops forever.

# Dotnet runtime — use invariant globalization, disable auto-updates
# LD_LIBRARY_PATH intentionally NOT set: runner finds its native libs via patchelf RPATH
# Setting LD_LIBRARY_PATH with Ubuntu libs breaks nix's tar (vdso glibc conflict)
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
export DOTNET_RUNNING_IN_CONTAINER=1
export RUNNER_DISABLE_UPDATES=1

RUNNER_DIR="/home/runner/workspace/actions-runner"
LOG_FILE="/home/runner/workspace/runner-main.log"
REPO_URL="https://github.com/nastech-ai/NasDoor"
RUNNER_NAME="replit-runner"
LABELS="self-hosted,replit,Linux,X64"
RUNNER_VERSION="2.324.0"
RUNNER_ARCH="linux-x64"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

get_reg_token() {
  python3 -c "
import json, os, urllib.request, sys
PAT = os.environ.get('GITHUB_PERSONAL_ACCESS_TOKEN','')
if not PAT: sys.exit(1)
req = urllib.request.Request(
    'https://api.github.com/repos/nastech-ai/NasDoor/actions/runners/registration-token',
    method='POST')
req.add_header('Authorization', f'Bearer {PAT}')
req.add_header('Accept', 'application/vnd.github+json')
req.add_header('X-GitHub-Api-Version', '2022-11-28')
with urllib.request.urlopen(req, timeout=20) as r:
    print(json.loads(r.read())['token'])
" 2>/dev/null
}

patch_runner_libs() {
  # Add RPATH to runner's native .so files so they find their deps without LD_LIBRARY_PATH
  # This avoids polluting child processes (tar, git, etc.) with Ubuntu lib paths
  local PATCHELF
  PATCHELF=$(find /nix/store -maxdepth 2 -name "patchelf" -type f 2>/dev/null | head -1)
  if [ -z "$PATCHELF" ]; then return; fi

  local RUNNER_LIBS="/home/runner/workspace/runner-libs"
  mkdir -p "$RUNNER_LIBS"
  # Symlink Ubuntu-provided libstdc++ and libz into runner-libs
  ln -sf /usr/lib/x86_64-linux-gnu/libstdc++.so.6 "$RUNNER_LIBS/libstdc++.so.6" 2>/dev/null || true
  ln -sf /usr/lib/x86_64-linux-gnu/libz.so.1      "$RUNNER_LIBS/libz.so.1"      2>/dev/null || true
  # Also symlink into netcoredeps for Runner.Listener itself
  mkdir -p "$RUNNER_DIR/bin/netcoredeps"
  ln -sf /usr/lib/x86_64-linux-gnu/libstdc++.so.6 "$RUNNER_DIR/bin/netcoredeps/libstdc++.so.6" 2>/dev/null || true

  # Patch the .so files that lack RUNPATH
  for SO in libcoreclr.so libSystem.IO.Compression.Native.so libSystem.Security.Cryptography.Native.OpenSsl.so; do
    local SO_PATH="$RUNNER_DIR/bin/$SO"
    [ -f "$SO_PATH" ] || continue
    "$PATCHELF" --add-rpath "$RUNNER_LIBS" "$SO_PATH" 2>/dev/null && log "Patched RPATH: $SO" || true
  done
}

install_runner() {
  log "Installing runner v${RUNNER_VERSION}..."
  mkdir -p "$RUNNER_DIR"
  local TARBALL="actions-runner-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
  curl -sL --retry 5 --retry-delay 3 \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}" \
    -o "$RUNNER_DIR/runner.tar.gz"
  tar xzf "$RUNNER_DIR/runner.tar.gz" -C "$RUNNER_DIR"
  rm -f "$RUNNER_DIR/runner.tar.gz"
  patch_runner_libs
  log "Runner binary installed at $RUNNER_DIR"
}

configure_runner() {
  log "Registering runner with GitHub..."
  local TOKEN
  TOKEN=$(get_reg_token)
  if [ -z "$TOKEN" ]; then
    log "ERROR: Could not get registration token"
    return 1
  fi
  cd "$RUNNER_DIR"
  DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
  ./config.sh \
    --url "$REPO_URL" \
    --token "$TOKEN" \
    --name "$RUNNER_NAME" \
    --labels "$LABELS" \
    --work "_work" \
    --unattended \
    --replace 2>&1 | tee -a "$LOG_FILE"
  log "Runner configured."
}

# ── Symlink for backward compat ───────────────────────────────────────────────
ln -sf "$RUNNER_DIR" /home/runner/actions-runner 2>/dev/null || true

# ── Install binary if missing ─────────────────────────────────────────────────
if [ ! -f "$RUNNER_DIR/run.sh" ]; then
  install_runner
else
  # Already installed — still patch RPATH so libs are found without LD_LIBRARY_PATH
  patch_runner_libs
fi

# ── Register if not configured ────────────────────────────────────────────────
if [ ! -f "$RUNNER_DIR/.runner" ]; then
  configure_runner || { log "Config failed, will retry"; sleep 15; }
fi

# ── Main run loop ─────────────────────────────────────────────────────────────
log "=== Runner main loop started (PID $$) ==="
RESTART_COUNT=0

while true; do
  RESTART_COUNT=$((RESTART_COUNT + 1))
  log "Starting runner (attempt #$RESTART_COUNT)..."

  cd "$RUNNER_DIR"
  DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
  ./run.sh 2>&1 | tee -a "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}

  log "Runner process exited with code $EXIT_CODE."

  # Exit code 0 = clean shutdown (deregistered remotely) → re-register
  if [ "$EXIT_CODE" -eq 0 ] || [ "$EXIT_CODE" -eq 1 ]; then
    rm -f "$RUNNER_DIR/.runner" "$RUNNER_DIR/.credentials" \
          "$RUNNER_DIR/.credentials_rsaparams" 2>/dev/null || true
    configure_runner || true
  fi

  WAIT=$((RESTART_COUNT < 5 ? 5 : 30))
  log "Waiting ${WAIT}s before restart..."
  sleep "$WAIT"
done
