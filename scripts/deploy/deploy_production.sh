#!/usr/bin/env bash

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-prod}"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"
APP_NAME="${DEPLOY_APP_NAME:-anime-track}"
PREVIEW_PORT="${DEPLOY_PREVIEW_PORT:-3101}"
PRODUCTION_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://127.0.0.1:3000/api/health}"
PRODUCTION_URL="${DEPLOY_BASE_URL:-${PRODUCTION_HEALTHCHECK_URL%/api/health}}"
PREVIEW_URL="http://127.0.0.1:${PREVIEW_PORT}"
DEPLOY_ROOT="$WORKSPACE_ROOT/.deploy"
CURRENT_LINK="$DEPLOY_ROOT/current"
NEXT_LINK="$DEPLOY_ROOT/current-next"
PREVIOUS_LINK="$DEPLOY_ROOT/previous"
PREVIOUS_NEXT_LINK="$DEPLOY_ROOT/previous-next"
LAST_BUILT_FILE="$DEPLOY_ROOT/last-built-release"

log() {
  printf '[deploy:%s %s] %s\n' "$MODE" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

if [[ "$MODE" != "test" && "$MODE" != "prod" ]]; then
  fail "Mode must be test or prod"
fi

cd "$WORKSPACE_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Current directory is not a Git repository"
fi

if [[ "$MODE" == "prod" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    fail "Production deployment requires a clean Git working tree"
  fi

  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$current_branch" != "$BRANCH" ]]; then
    fail "Production deployment must run from branch $BRANCH (current: $current_branch)"
  fi

  log "Fetching latest code from $REMOTE/$BRANCH"
  git fetch "$REMOTE" "$BRANCH"
  git merge --ff-only "$REMOTE/$BRANCH"
else
  if [[ -n "$(git status --porcelain)" ]]; then
    log "Building an uncommitted test release"
  else
    log "Building a clean test release"
  fi
fi

if [[ ! -d node_modules ]]; then
  log "Installing dependencies with npm ci"
  npm ci
fi

log "Building an isolated candidate release"
npm run build

[[ -f "$LAST_BUILT_FILE" ]] || fail "Build did not record a candidate release"
release_dir="$(tr -d '\r\n' < "$LAST_BUILT_FILE")"
[[ -f "$release_dir/server.js" ]] || fail "Candidate server is missing: $release_dir/server.js"

if curl -fsS -o /dev/null --max-time 2 "$PREVIEW_URL/api/health" 2>/dev/null; then
  fail "Preview port $PREVIEW_PORT is already in use"
fi

preview_log="$DEPLOY_ROOT/preview.log"
log "Starting candidate on $PREVIEW_URL"
ANIMETRACK_RELEASE_DIR="$release_dir" \
HOST="127.0.0.1" \
PORT="$PREVIEW_PORT" \
node "$WORKSPACE_ROOT/scripts/deploy/prod_start_guard.js" >"$preview_log" 2>&1 &
preview_pid=$!

cleanup_preview() {
  if kill -0 "$preview_pid" 2>/dev/null; then
    kill "$preview_pid" 2>/dev/null || true
    wait "$preview_pid" 2>/dev/null || true
  fi
}
trap cleanup_preview EXIT

if ! bash "$WORKSPACE_ROOT/scripts/deploy/wait_for_healthcheck.sh" \
  "$PREVIEW_URL/api/health" 20 1 5; then
  tail -80 "$preview_log" || true
  fail "Candidate healthcheck failed"
fi
node "$WORKSPACE_ROOT/scripts/deploy/verify_static_assets.js" "$PREVIEW_URL"
cleanup_preview
trap - EXIT

log "Candidate passed checks; switching active release"
mkdir -p "$DEPLOY_ROOT"
previous_release=""
if [[ -L "$CURRENT_LINK" ]]; then
  previous_release="$(readlink -f "$CURRENT_LINK")"
fi
if [[ -n "$previous_release" && -f "$previous_release/server.js" ]]; then
  rm -f "$PREVIOUS_NEXT_LINK"
  ln -s "$previous_release" "$PREVIOUS_NEXT_LINK"
  mv -Tf "$PREVIOUS_NEXT_LINK" "$PREVIOUS_LINK"
fi
rm -f "$NEXT_LINK"
ln -s "$release_dir" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT_LINK"

rollback_release() {
  if [[ -z "$previous_release" || ! -f "$previous_release/server.js" ]]; then
    log "No previous release is available for automatic rollback"
    return
  fi

  log "Rolling back to $previous_release"
  rm -f "$NEXT_LINK"
  ln -s "$previous_release" "$NEXT_LINK"
  mv -Tf "$NEXT_LINK" "$CURRENT_LINK"
  pm2 restart "$WORKSPACE_ROOT/ecosystem.config.js" --only "$APP_NAME" --update-env \
    || log "Rollback PM2 restart failed"
  bash "$WORKSPACE_ROOT/scripts/deploy/wait_for_healthcheck.sh" \
    "$PRODUCTION_HEALTHCHECK_URL" 10 2 15 \
    || log "Rollback healthcheck failed"
}

log "Reloading PM2 app $APP_NAME"
pm2 restart "$WORKSPACE_ROOT/ecosystem.config.js" --only "$APP_NAME" --update-env

if ! bash "$WORKSPACE_ROOT/scripts/deploy/wait_for_healthcheck.sh" \
  "$PRODUCTION_HEALTHCHECK_URL" 10 2 15; then
  rollback_release
  fail "Production healthcheck failed"
fi
if ! node "$WORKSPACE_ROOT/scripts/deploy/verify_static_assets.js" "$PRODUCTION_URL"; then
  rollback_release
  fail "Production static asset check failed"
fi

release_label="$(node -e "const m=require(process.argv[1]); console.log(m.releaseName)" "$release_dir/release.json")"
log "Deployment finished successfully with release $release_label"
