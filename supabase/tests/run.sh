#!/usr/bin/env bash
# Run the schema + RLS tests against a scratch database on a plain
# Postgres 15+ server with PostGIS installed (no Supabase/Docker needed).
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=rumputbn_test_$$
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $DB" >/dev/null
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/supabase_stub.sql
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/marketplace_test.sql 2>&1 | sed -E 's/^psql:[^ ]+ NOTICE:  //'
