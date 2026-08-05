#!/bin/sh
set -eu

: "${BACKUP_DESTINATION:?BACKUP_DESTINATION must be an absolute path on controlled storage}"

backup_project_name="${COMPOSE_PROJECT_NAME:-profit-decision}"
backup_script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
backup_repo_root=$(CDPATH='' cd -- "$backup_script_dir/.." && pwd)
backup_started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
backup_snapshot_name=$(date -u '+%Y%m%dT%H%M%SZ')
backup_snapshot_dir="${BACKUP_DESTINATION%/}/$backup_snapshot_name"

case "$BACKUP_DESTINATION" in
	/*) ;;
	*) echo "BACKUP_DESTINATION must be absolute" >&2; exit 1 ;;
esac
if [ -e "$backup_snapshot_dir" ]; then
	echo "snapshot already exists: $backup_snapshot_dir" >&2
	exit 1
fi
mkdir -p "$backup_snapshot_dir"

cd "$backup_repo_root"
docker compose -p "$backup_project_name" exec -T db \
	pg_dump -U profit_decision -d profit_decision --format=custom --data-only --exclude-table-data=goose_db_version \
	> "$backup_snapshot_dir/database.dump"

docker run --rm \
	-v "${backup_project_name}_import-files:/source:ro" \
	-v "$backup_snapshot_dir:/backup" \
	alpine:3.23 sh -c 'tar -C /source -czf /backup/import-files.tar.gz .'

backup_git_revision=$(git rev-parse HEAD)
backup_migration_version=$(docker compose -p "$backup_project_name" exec -T db \
	psql -U profit_decision -d profit_decision -Atc "SELECT coalesce(max(version_id),0) FROM goose_db_version WHERE is_applied")
backup_batch_count=$(docker compose -p "$backup_project_name" exec -T db \
	psql -U profit_decision -d profit_decision -Atc 'SELECT count(*) FROM import_batch')
backup_file_count=$(docker run --rm -v "${backup_project_name}_import-files:/source:ro" alpine:3.23 \
	sh -c 'find /source -maxdepth 1 -type f | wc -l | tr -d " "')

printf '%s\n' \
	"status=complete" \
	"started_at=$backup_started_at" \
	"completed_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
	"compose_project=$backup_project_name" \
	"git_revision=$backup_git_revision" \
	"migration_version=$backup_migration_version" \
	"batch_count=$backup_batch_count" \
	"xlsx_file_count=$backup_file_count" \
	> "$backup_snapshot_dir/manifest.txt"

(
	cd "$backup_snapshot_dir"
	sha256sum database.dump import-files.tar.gz manifest.txt > SHA256SUMS
)

printf 'backup_snapshot=%s\n' "$backup_snapshot_dir"
