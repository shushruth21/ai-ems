#!/usr/bin/env bash
# Applies supabase/migrations/*.sql in order (idempotent scripts).
# Run AFTER `prisma migrate deploy`.
#   DATABASE_URL=postgresql://… infrastructure/scripts/apply-supabase-sql.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL (direct, session-mode connection) is required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

shopt -s nullglob
files=("$root"/supabase/migrations/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No SQL migrations found" >&2
  exit 1
fi

for file in "${files[@]}"; do
  echo "→ applying $(basename "$file")"
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction --quiet --file "$file"
done
echo "✓ Supabase SQL applied (${#files[@]} files)"
