#!/bin/bash
# NasDoor — GitHub Actions self-hosted runner
# Installs runner inside persistent workspace if missing, then loops forever.

export LD_LIBRARY_PATH="$HOME/.nix-profile/lib:$LD_LIBRARY_PATH"

RUNNER_DIR="/home/runner/workspace/actions-runner"
LOG_FILE="/home/runner/workspace/runner-main.log"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

log "=== Runner main loop started (PID $$) ==="

# ── Install runner binary if missing ─────────────────────────────────────────
if [ ! -f "$RUNNER_DIR/run.sh" ]; then
  log "Runner binary missing — downloading v2.324.0..."
  mkdir -p "$RUNNER_DIR"
  curl -sL --retry 5 \
    "https://github.com/actions/runner/releases/download/v2.324.0/actions-runner-linux-x64-2.324.0.tar.gz" \
    -o "$RUNNER_DIR/runner.tar.gz"
  tar xzf "$RUNNER_DIR/runner.tar.gz" -C "$RUNNER_DIR"
  rm -f "$RUNNER_DIR/runner.tar.gz"
  log "Runner binary installed."
fi

# ── Register with GitHub if not configured ────────────────────────────────────
if [ ! -f "$RUNNER_DIR/.runner" ]; then
  log "Runner not registered — getting registration token..."
  REG_TOKEN=$(python3 -c "
import json, os, urllib.request
PAT = os.environ.get('GITHUB_PERSONAL_ACCESS_TOKEN','')
if not PAT: exit(1)
req = urllib.request.Request('https://api.github.com/repos/nastech-ai/NasDoor/actions/runners/registration-token', method='POST')
req.add_header('Authorization', f'Bearer {PAT}')
req.add_header('Accept', 'application/vnd.github+json')
req.add_header('X-GitHub-Api-Version', '2022-11-28')
with urllib.request.urlopen(req, timeout=15) as r:
    print(json.loads(r.read())['token'])
" 2>/dev/null)
  if [ -z "$REG_TOKEN" ]; then
    log "ERROR: Could not get registration token (is GITHUB_PERSONAL_ACCESS_TOKEN set?)"
    sleep 60
    exec "$0"
  fi

  log "Configuring runner..."
  cd "$RUNNER_DIR"
  ./config.sh \
    --url "https://github.com/nastech-ai/NasDoor" \
    --token "$REG_TOKEN" \
    --name "replit-runner" \
    --labels "self-hosted,replit,Linux,X64" \
    --work "_work" \
    --unattended \
    --replace \
    2>&1 | tee -a "$LOG_FILE"
  log "Runner configured."
fi

# ── Run loop ─────────────────────────────────────────────────────────────────
RESTART_COUNT=0

while true; do
  RESTART_COUNT=$((RESTART_COUNT + 1))
  log "Starting runner (attempt #$RESTART_COUNT)..."

  cd "$RUNNER_DIR"
  ./run.sh 2>&1 | tee -a "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}

  log "Runner process exited with code $EXIT_CODE."

  # If runner exited cleanly (0) it may have been deregistered — re-register
  if [ "$EXIT_CODE" -eq 0 ]; then
    log "Clean exit — runner may need re-registration on next loop"
    rm -f "$RUNNER_DIR/.runner" "$RUNNER_DIR/.credentials" "$RUNNER_DIR/.credentials_rsaparams" 2>/dev/null
  fi

  WAIT=$((RESTART_COUNT < 5 ? 5 : 30))
  log "Waiting ${WAIT}s before restart..."
  sleep "$WAIT"
done
