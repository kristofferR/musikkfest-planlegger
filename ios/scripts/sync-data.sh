#!/bin/sh
# Copies the canonical festival program data from the web app's source of truth
# (../src/data/program.json) into the iOS app bundle resources, so the monorepo
# keeps a single source of truth. Run before building / archiving.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SRC="$SCRIPT_DIR/../../src/data/program.json"
DST="$SCRIPT_DIR/../Musikkfest/Resources/program.json"

if [ ! -f "$SRC" ]; then
  echo "sync-data: source not found: $SRC" >&2
  exit 1
fi

cp "$SRC" "$DST"
echo "sync-data: copied $(wc -c < "$DST" | tr -d ' ') bytes -> $DST"
