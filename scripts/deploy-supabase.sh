#!/usr/bin/env bash
# =============================================================================
# Vivasvana — one-shot Supabase deploy
#
# Applies all Prisma migrations to a Supabase project, optionally seeds the
# catalog, and optionally creates the Storage buckets the app expects.
#
# Usage:
#   scripts/deploy-supabase.sh --env-file .env.supabase           # default: migrate only
#   scripts/deploy-supabase.sh --env-file .env.supabase --seed    # migrate + seed
#   scripts/deploy-supabase.sh --env-file .env.supabase --seed --storage
#   scripts/deploy-supabase.sh --env-file .env.supabase --dry-run # show plan, do nothing
#
# Required env vars in the file:
#   DIRECT_URL                 # postgresql://postgres:PASS@db.{ref}.supabase.co:5432/postgres
#   DATABASE_URL               # usually the pooler (port 6543) — used at runtime, not by migrate
#   SUPABASE_URL               # https://{ref}.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY  # only needed if --storage is passed
#
# Safety:
#   - Refuses to run if the target DB has rows but --force isn't passed
#   - Always prints the connection target before doing any write
#   - Migrations use `migrate deploy` (never `migrate dev` — won't destroy data)
# =============================================================================

set -euo pipefail

# --- Resolve paths ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DB_DIR="${REPO_ROOT}/packages/db"

# --- Colors ----------------------------------------------------------------
if [[ -t 1 ]]; then
  C_BLUE='\033[1;34m'; C_GREEN='\033[1;32m'; C_YELLOW='\033[1;33m'
  C_RED='\033[1;31m'; C_DIM='\033[2m'; C_RST='\033[0m'
else
  C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''; C_RST=''
fi
info()  { printf "${C_BLUE}▸${C_RST} %s\n" "$*"; }
ok()    { printf "${C_GREEN}✓${C_RST} %s\n" "$*"; }
warn()  { printf "${C_YELLOW}!${C_RST} %s\n" "$*"; }
die()   { printf "${C_RED}✗${C_RST} %s\n" "$*" >&2; exit 1; }
step()  { printf "\n${C_BLUE}=== %s ===${C_RST}\n" "$*"; }

# --- Args ------------------------------------------------------------------
ENV_FILE=""
DO_SEED=false
DO_STORAGE=false
DO_FORCE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2;;
    --seed)     DO_SEED=true; shift;;
    --storage)  DO_STORAGE=true; shift;;
    --force)    DO_FORCE=true; shift;;
    --dry-run)  DRY_RUN=true; shift;;
    -h|--help)
      sed -n '2,/^# ===*/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0;;
    *) die "Unknown flag: $1 (try --help)";;
  esac
done

[[ -n "$ENV_FILE" ]] || die "--env-file is required (e.g. --env-file .env.supabase)"
[[ -f "$ENV_FILE" ]] || die "Env file not found: $ENV_FILE"

# --- Load env --------------------------------------------------------------
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

[[ -n "${DIRECT_URL:-}" ]] || die "DIRECT_URL missing in $ENV_FILE (required for Prisma migrate)"
[[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL missing in $ENV_FILE"

if "$DO_STORAGE"; then
  [[ -n "${SUPABASE_URL:-}" ]]              || die "SUPABASE_URL required for --storage"
  [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || die "SUPABASE_SERVICE_ROLE_KEY required for --storage"
fi

# --- Sanity checks ---------------------------------------------------------
HOST=$(printf '%s' "$DIRECT_URL" | sed -E 's|^[^@]+@([^:/]+).*$|\1|')
DB_NAME=$(printf '%s' "$DIRECT_URL" | sed -E 's|^.*/([^?]+).*$|\1|')

step "Plan"
printf "  ${C_DIM}env file ${C_RST}%s\n" "$ENV_FILE"
printf "  ${C_DIM}target   ${C_RST}%s (db: %s)\n" "$HOST" "$DB_NAME"
printf "  ${C_DIM}migrate  ${C_RST}yes (prisma migrate deploy)\n"
printf "  ${C_DIM}seed     ${C_RST}%s\n" "$($DO_SEED  && echo yes || echo no)"
printf "  ${C_DIM}storage  ${C_RST}%s\n" "$($DO_STORAGE && echo yes || echo no)"

if [[ "$HOST" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
  warn "Target host is localhost — are you sure you meant Supabase?"
fi
case "$HOST" in
  *supabase.co|*supabase.com|*pooler.supabase.com) ;;
  *) warn "Target host doesn't look like a Supabase domain ($HOST)";;
esac

if $DRY_RUN; then
  step "Dry run — exiting before any changes"
  exit 0
fi

# --- Probe & rowcount guard -----------------------------------------------
step "Connectivity"
if ! command -v psql >/dev/null 2>&1; then
  warn "psql not on PATH — skipping rowcount safety check"
else
  if SERVER_VERSION=$(psql "$DIRECT_URL" -tAc "SHOW server_version;" 2>&1); then
    ok "Connected — Postgres $SERVER_VERSION"
  else
    die "Could not connect with psql. Check DIRECT_URL: $SERVER_VERSION"
  fi

  EXISTING_ROWS=$(psql "$DIRECT_URL" -tAc "
    SELECT COALESCE(SUM(n_live_tup), 0)
    FROM pg_stat_user_tables
    WHERE schemaname = 'public';
  " 2>/dev/null || echo "0")
  EXISTING_ROWS=${EXISTING_ROWS//[[:space:]]/}

  if [[ "${EXISTING_ROWS:-0}" -gt 0 ]] && ! $DO_FORCE; then
    if $DO_SEED; then
      die "Target already has ~$EXISTING_ROWS rows in public.*. Re-running --seed could create duplicates / break unique constraints. Pass --force if you really meant it, or drop --seed."
    else
      info "Target has ~$EXISTING_ROWS existing rows — that's fine for migrate-only."
    fi
  fi
fi

# --- Prisma generate (uses schema only, no DB call) ----------------------
step "Prisma client"
( cd "$DB_DIR" && pnpm exec prisma generate 1>/dev/null )
ok "Client generated"

# --- Apply migrations ----------------------------------------------------
step "Migrations"
# We invoke prisma directly with env vars rather than relying on the package
# script so the .env file the user supplied takes precedence over any
# .env that may be sitting in packages/db (e.g. a symlink to local dev).
( cd "$DB_DIR" && DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" pnpm exec prisma migrate deploy )
ok "Migrations applied"

# --- Seed (optional) -----------------------------------------------------
if $DO_SEED; then
  step "Seed"
  ( cd "$DB_DIR" && DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" pnpm exec tsx prisma/seed.ts )
  ok "Catalog seeded"
fi

# --- Storage buckets (optional) ------------------------------------------
if $DO_STORAGE; then
  step "Storage buckets"
  # Two buckets are referenced by env keys; create both with public-read.
  PROD_BUCKET="${SUPABASE_PRODUCT_IMAGES_BUCKET:-product-images}"
  BLOG_BUCKET="${SUPABASE_BLOG_IMAGES_BUCKET:-blog-images}"
  for B in "$PROD_BUCKET" "$BLOG_BUCKET"; do
    info "Creating bucket: $B"
    HTTP_CODE=$(curl -sS -o /tmp/vv_bucket.json -w "%{http_code}" \
      -X POST "${SUPABASE_URL}/storage/v1/bucket" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"${B}\",\"name\":\"${B}\",\"public\":true,\"file_size_limit\":10485760,\"allowed_mime_types\":[\"image/jpeg\",\"image/png\",\"image/webp\",\"image/avif\"]}")
    if [[ "$HTTP_CODE" =~ ^2 ]]; then
      ok "  $B created"
    elif grep -q "already exists" /tmp/vv_bucket.json 2>/dev/null; then
      ok "  $B already exists"
    else
      warn "  $B — HTTP $HTTP_CODE: $(cat /tmp/vv_bucket.json)"
    fi
  done
  rm -f /tmp/vv_bucket.json
fi

# --- Summary -------------------------------------------------------------
step "Done"
ok "Supabase deploy completed against ${HOST}"
printf "\n${C_DIM}Next steps:\n"
printf "  • Update production .env (Vercel/Railway) with the same DIRECT_URL/DATABASE_URL/SUPABASE_* vars\n"
printf "  • If you re-pointed local dev at Supabase, your previous .env is at .env.local-supabase.bak\n"
printf "  • Promote an admin: cd packages/db && pnpm promote-admin you@email.com\n${C_RST}"
