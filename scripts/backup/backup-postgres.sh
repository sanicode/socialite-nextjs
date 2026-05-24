#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-${APP_DIR}/.env}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Command '$1' tidak ditemukan"
}

read_env() {
  local key="$1"
  node - "$ENV_FILE" "$key" <<'NODE'
const fs = require('fs')
const path = process.argv[2]
const key = process.argv[3]

if (process.env[key]) {
  process.stdout.write(process.env[key])
  process.exit(0)
}

if (!fs.existsSync(path)) process.exit(0)

for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/)
  if (!match || match[1] !== key) continue

  let value = match[2] || ''
  if (value.startsWith('"')) {
    const end = value.lastIndexOf('"')
    value = value.slice(1, end > 0 ? end : undefined).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  } else if (value.startsWith("'")) {
    const end = value.lastIndexOf("'")
    value = value.slice(1, end > 0 ? end : undefined)
  } else {
    value = value.replace(/\s+#.*$/, '').trim()
  }

  process.stdout.write(value)
  process.exit(0)
}
NODE
}

require_command node
require_command pg_dump
require_command gzip

DATABASE_URL="$(read_env BACKUP_DATABASE_URL)"
if [[ -z "$DATABASE_URL" ]]; then
  DATABASE_URL="$(read_env DATABASE_URL)"
fi

LOCAL_DIR="$(read_env BACKUP_LOCAL_DIR)"
RETENTION_DAYS="$(read_env BACKUP_RETENTION_DAYS)"
REMOTE_TARGET="$(read_env BACKUP_REMOTE_TARGET)"
REMOTE_RETENTION_DAYS="$(read_env BACKUP_REMOTE_RETENTION_DAYS)"
SSH_KEY="$(read_env BACKUP_SSH_KEY)"
SSH_PORT="$(read_env BACKUP_SSH_PORT)"

[[ -n "$DATABASE_URL" ]] || fail "BACKUP_DATABASE_URL atau DATABASE_URL belum diset di ${ENV_FILE}"

LOCAL_DIR="${LOCAL_DIR:-${APP_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"
SSH_PORT="${SSH_PORT:-22}"

mkdir -p "$LOCAL_DIR"

timestamp="$(date '+%Y%m%d-%H%M%S')"
hostname="$(hostname -s 2>/dev/null || hostname)"
backup_file="${LOCAL_DIR}/socialite-${hostname}-${timestamp}.sql.gz"

log "Mulai backup PostgreSQL ke ${backup_file}"
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges | gzip -9 > "$backup_file"

log "Membersihkan backup lokal lebih dari ${RETENTION_DAYS} hari"
find "$LOCAL_DIR" -type f -name 'socialite-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

if [[ -n "$REMOTE_TARGET" ]]; then
  require_command scp
  require_command ssh

  ssh_opts=(-P "$SSH_PORT")
  remote_ssh_opts=(-p "$SSH_PORT")
  if [[ -n "$SSH_KEY" ]]; then
    ssh_opts+=(-i "$SSH_KEY")
    remote_ssh_opts+=(-i "$SSH_KEY")
  fi

  log "Mengirim backup ke ${REMOTE_TARGET}"
  scp "${ssh_opts[@]}" "$backup_file" "$REMOTE_TARGET"

  remote_dir="${REMOTE_TARGET#*:}"
  remote_host="${REMOTE_TARGET%%:*}"
  if [[ "$REMOTE_TARGET" == *:* && -n "$remote_dir" && "$remote_host" != "$REMOTE_TARGET" ]]; then
    log "Membersihkan backup remote lebih dari ${REMOTE_RETENTION_DAYS} hari"
    ssh "${remote_ssh_opts[@]}" "$remote_host" \
      "find '$remote_dir' -type f -name 'socialite-*.sql.gz' -mtime +${REMOTE_RETENTION_DAYS} -delete"
  fi
fi

log "Backup selesai"
