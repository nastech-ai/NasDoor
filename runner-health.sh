#!/bin/bash
# Health monitor: checks runner status via GitHub API every 60s
# Auto re-registers with a fresh token if the runner goes offline or is missing

OWNER="nastech-ai"
REPO="NasDoor"
RUNNER_NAME="replit-runner"
RUNNER_DIR="/home/runner/actions-runner"
LOG_FILE="/home/runner/workspace/runner-health.log"
LABELS="self-hosted,replit,linux,x64"

export LD_LIBRARY_PATH="$HOME/.nix-profile/lib:$LD_LIBRARY_PATH"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG_FILE"
}

get_runner_status() {
  curl -sf \
    -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/actions/runners" \
    2>/dev/null | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
runners = data.get('runners', [])
for r in runners:
    if r.get('name') == '$RUNNER_NAME':
        print(r.get('status','unknown'))
        sys.exit(0)
print('missing')
" 2>/dev/null
}

get_remove_token() {
  curl -sf \
    -X POST \
    -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/actions/runners/remove-token" \
    2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null
}

get_registration_token() {
  curl -sf \
    -X POST \
    -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/actions/runners/registration-token" \
    2>/dev/null | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null
}

reregister_runner() {
  log "Re-registering runner with fresh token..."

  cd "$RUNNER_DIR" || { log "ERROR: Runner dir not found"; return 1; }

  # Step 1: remove existing config if present
  if [ -f ".runner" ]; then
    log "Removing existing runner config..."
    local RMTOKEN
    RMTOKEN=$(get_remove_token)
    if [ -n "$RMTOKEN" ]; then
      ./config.sh remove --token "$RMTOKEN" 2>&1 | tee -a "$LOG_FILE" || true
    else
      # Force-remove local files if API token failed
      rm -f .runner .credentials .credentials_rsaparams 2>/dev/null || true
    fi
  fi

  sleep 2

  # Step 2: register fresh
  local REGTOKEN
  REGTOKEN=$(get_registration_token)
  if [ -z "$REGTOKEN" ]; then
    log "ERROR: Could not obtain registration token from GitHub API."
    return 1
  fi

  ./config.sh \
    --url "https://github.com/$OWNER/$REPO" \
    --token "$REGTOKEN" \
    --name "$RUNNER_NAME" \
    --labels "$LABELS" \
    --unattended 2>&1 | tee -a "$LOG_FILE"

  log "Re-registration complete. Runner loop will reconnect on next cycle."
}

log "=== Health monitor started ==="

CONSECUTIVE_OFFLINE=0

while true; do
  STATUS=$(get_runner_status)
  log "Runner status: $STATUS"

  case "$STATUS" in
    online)
      CONSECUTIVE_OFFLINE=0
      ;;
    offline)
      CONSECUTIVE_OFFLINE=$((CONSECUTIVE_OFFLINE + 1))
      log "Runner offline (count: $CONSECUTIVE_OFFLINE / 3)"
      if [ "$CONSECUTIVE_OFFLINE" -ge 3 ]; then
        log "Runner offline 3 checks in a row — triggering re-registration..."
        reregister_runner
        CONSECUTIVE_OFFLINE=0
        sleep 15
      fi
      ;;
    missing)
      log "Runner not found on GitHub — re-registering immediately..."
      reregister_runner
      CONSECUTIVE_OFFLINE=0
      sleep 15
      ;;
    *)
      log "Could not determine runner status (API error / missing token)"
      ;;
  esac

  sleep 60
done
