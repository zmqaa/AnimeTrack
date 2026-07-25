#!/usr/bin/env bash

set -u

URL="${1:-}"
ATTEMPTS="${2:-10}"
DELAY_SECONDS="${3:-2}"
TIMEOUT_SECONDS="${4:-15}"

if [[ -z "$URL" ]]; then
  printf '[healthcheck] ERROR: URL is required\n' >&2
  exit 2
fi

if ! [[ "$ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  printf '[healthcheck] ERROR: attempts must be a positive integer\n' >&2
  exit 2
fi

if ! [[ "$DELAY_SECONDS" =~ ^[0-9]+$ ]]; then
  printf '[healthcheck] ERROR: delay must be a non-negative integer\n' >&2
  exit 2
fi

if ! [[ "$TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  printf '[healthcheck] ERROR: timeout must be a positive integer\n' >&2
  exit 2
fi

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  if curl -fsS -o /dev/null --max-time "$TIMEOUT_SECONDS" "$URL" 2>/dev/null; then
    printf '[healthcheck] Ready on attempt %d/%d: %s\n' "$attempt" "$ATTEMPTS" "$URL"
    exit 0
  fi

  if ((attempt < ATTEMPTS)); then
    printf '[healthcheck] Not ready on attempt %d/%d; retrying in %ss\n' \
      "$attempt" "$ATTEMPTS" "$DELAY_SECONDS"
    if ((DELAY_SECONDS > 0)); then
      sleep "$DELAY_SECONDS"
    fi
  fi
done

printf '[healthcheck] ERROR: service did not become ready after %d attempts: %s\n' \
  "$ATTEMPTS" "$URL" >&2
exit 1
