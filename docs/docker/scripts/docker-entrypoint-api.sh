#!/bin/sh
# API container entrypoint: migrate (best-effort when script exists), then exec CMD.
set -eu

if [ "${SKIP_MIGRATE:-false}" != "true" ]; then
  if command -v pnpm >/dev/null 2>&1 && [ -f package.json ]; then
    echo "[entrypoint] running database migrations…"
    pnpm --filter @lp/db migrate:deploy || {
      echo "[entrypoint] migrate:deploy failed or package script missing; continuing only if ALLOW_MIGRATE_FAIL=true"
      if [ "${ALLOW_MIGRATE_FAIL:-false}" != "true" ]; then
        exit 1
      fi
    }
  else
    echo "[entrypoint] pnpm/@lp/db not available in image layout; skip migrate (set up during scaffold)"
  fi
fi

exec "$@"
