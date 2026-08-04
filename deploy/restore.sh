#!/bin/sh
set -eu

: "${RESTORE_SNAPSHOT:?RESTORE_SNAPSHOT must point to a verified snapshot directory}"

restore_project_name="${COMPOSE_PROJECT_NAME:-profit-decision}"
restore_script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
restore_repo_root=$(CDPATH='' cd -- "$restore_script_dir/.." && pwd)

case "$RESTORE_SNAPSHOT" in
	/*) ;;
	*) echo "RESTORE_SNAPSHOT must be absolute" >&2; exit 1 ;;
esac
for restore_required_file in database.dump import-files.tar.gz manifest.txt SHA256SUMS; do
	if [ ! -f "$RESTORE_SNAPSHOT/$restore_required_file" ]; then
		echo "snapshot file missing: $restore_required_file" >&2
		exit 1
	fi
done
(
	cd "$RESTORE_SNAPSHOT"
	sha256sum -c SHA256SUMS
)

cd "$restore_repo_root"
docker compose -p "$restore_project_name" exec -T db psql -U profit_decision -d profit_decision -v ON_ERROR_STOP=1 <<'SQL'
DO $restore_empty_database$
DECLARE
    restore_table record;
    restore_rows bigint;
BEGIN
    FOR restore_table IN
        SELECT schemaname, tablename FROM pg_tables
        WHERE schemaname='public' AND tablename<>'goose_db_version'
    LOOP
        EXECUTE format('SELECT count(*) FROM %I.%I', restore_table.schemaname, restore_table.tablename) INTO restore_rows;
        IF restore_rows > 0 THEN
            RAISE EXCEPTION 'restore target table %.% is not empty', restore_table.schemaname, restore_table.tablename;
        END IF;
    END LOOP;
END
$restore_empty_database$;
SQL

docker run --rm -v "${restore_project_name}_import-files:/target" alpine:3.23 \
	sh -c 'test -z "$(find /target -mindepth 1 -maxdepth 1 -print -quit)"' || {
	echo "restore target XLSX volume is not empty" >&2
	exit 1
}

docker run --rm -v "$RESTORE_SNAPSHOT:/snapshot:ro" alpine:3.23 \
	sh -c 'tar -tzf /snapshot/import-files.tar.gz >/dev/null'

docker compose -p "$restore_project_name" exec -T db \
	pg_restore -U profit_decision -d profit_decision --data-only --no-owner --disable-triggers --exit-on-error --single-transaction \
	< "$RESTORE_SNAPSHOT/database.dump"

docker run --rm \
	-v "${restore_project_name}_import-files:/target" \
	-v "$RESTORE_SNAPSHOT:/snapshot:ro" \
	alpine:3.23 sh -c 'tar -C /target -xzf /snapshot/import-files.tar.gz'

restore_batch_count=$(docker compose -p "$restore_project_name" exec -T db \
	psql -U profit_decision -d profit_decision -Atc 'SELECT count(*) FROM import_batch')
restore_file_count=$(docker run --rm -v "${restore_project_name}_import-files:/target:ro" alpine:3.23 \
	sh -c 'find /target -maxdepth 1 -type f | wc -l | tr -d " "')
printf 'restore_status=complete batch_count=%s xlsx_file_count=%s\n' "$restore_batch_count" "$restore_file_count"
