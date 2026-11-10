#!/bin/sh
# API container entrypoint: migrate (best-effort when script exists), then exec CMD.
set -eu

if [ "${SKIP_MIGRATE:-false}" != "true" ]; then
  migrated=false
  if command -v pnpm >/dev/null 2>&1 && [ -f package.json ] && grep -q '"@lp/db"' package.json 2>/dev/null; then
    if pnpm --filter @lp/db migrate:deploy; then
      migrated=true
    fi
  fi
  if [ "$migrated" = false ] && [ -f node_modules/@lp/db/dist/migrate-deploy.js ]; then
    echo "[entrypoint] running database migrations via @lp/db…"
    if node node_modules/@lp/db/dist/migrate-deploy.js; then
      migrated=true
    fi
  fi
  if [ "$migrated" = false ]; then
    echo "[entrypoint] migrate:deploy failed or unavailable"
    if [ "${ALLOW_MIGRATE_FAIL:-false}" != "true" ]; then
      exit 1
    fi
  fi
fi

exec "$@"
