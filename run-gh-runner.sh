#!/bin/bash
# Main runner loop — auto-restarts if the process exits for any reason

export LD_LIBRARY_PATH="$HOME/.nix-profile/lib:$LD_LIBRARY_PATH"
RUNNER_DIR="/home/runner/actions-runner"
LOG_FILE="/home/runner/workspace/runner-main.log"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

log "=== Runner main loop started (PID $$) ==="

RESTART_COUNT=0

while true; do
  RESTART_COUNT=$((RESTART_COUNT + 1))
  log "Starting runner (attempt #$RESTART_COUNT)..."

  cd "$RUNNER_DIR" && ./run.sh 2>&1 | tee -a "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}

  log "Runner process exited with code $EXIT_CODE."

  # Exponential-ish backoff capped at 30s
  WAIT=5
  if [ "$EXIT_CODE" -ne 0 ]; then
    WAIT=$((RESTART_COUNT < 5 ? 5 : 30))
  fi

  log "Waiting ${WAIT}s before restart..."
  sleep "$WAIT"
done
