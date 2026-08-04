#!/bin/sh
set -eu

umask 077
backup_timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
plain_path="/tmp/quran-${backup_timestamp}.dump"
encrypted_path="/backups/quran-${backup_timestamp}.dump.enc"

pg_dump --format=custom --file="$plain_path"
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$plain_path" \
  -out "$encrypted_path" \
  -pass env:BACKUP_ENCRYPTION_PASSWORD
rm -f "$plain_path"
find /backups -type f -name 'quran-*.dump.enc' -mtime +30 -delete
printf '%s backup_complete file=%s\n' "$backup_timestamp" "$encrypted_path"
