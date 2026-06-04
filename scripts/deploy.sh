#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
HOST=${MUSIKKFEST_DEPLOY_HOST:-root@65.21.5.205}
TARGET=${MUSIKKFEST_DEPLOY_TARGET:-/home/suboktav/htdocs/suboktav.no/musikkfest/}
CONTROL=${MUSIKKFEST_DEPLOY_CONTROL:-/tmp/suboktav-root-65.21.5.205.sock}

shell_quote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

if ssh -S "$CONTROL" -o BatchMode=yes -O check "$HOST" >/dev/null 2>&1; then
  SSH_OPTS="-o ControlPath=$CONTROL -o BatchMode=yes"
else
  SSH_OPTS="-o BatchMode=yes"
fi

PROTECT_FILE=$(mktemp)
trap 'rm -f "$PROTECT_FILE"' EXIT

REMOTE_TARGET=$(shell_quote "$TARGET")
REMOTE_STORAGE_OVERRIDE=$(shell_quote "${MUSIKKFEST_STORAGE_DIR:-}")

ssh $SSH_OPTS "$HOST" "TARGET_DIR=$REMOTE_TARGET STORAGE_OVERRIDE=$REMOTE_STORAGE_OVERRIDE sh -s" <<'REMOTE_STORAGE_SH'
set -eu

target=${TARGET_DIR%/}
site_root=$(dirname -- "$target")
htdocs_dir=$(dirname -- "$site_root")
account_root=$(dirname -- "$htdocs_dir")

if [ -n "$STORAGE_OVERRIDE" ]; then
  storage=$STORAGE_OVERRIDE
elif [ "$(basename -- "$htdocs_dir")" = "htdocs" ]; then
  storage="$account_root/.musikkfest-lister"
else
  storage="$site_root/.musikkfest-lister"
fi

old_storage="$site_root/.musikkfest-lister"
case "$old_storage" in
  */.musikkfest-lister) ;;
  *) echo "Refusing unsafe storage cleanup path: $old_storage" >&2; exit 1 ;;
esac

mkdir -p -- "$storage"
if [ -d "$old_storage" ] && [ "$old_storage" != "$storage" ]; then
  if [ -f "$old_storage/lists.json" ] && [ ! -f "$storage/lists.json" ]; then
    cp -p -- "$old_storage/lists.json" "$storage/lists.json"
  fi
  rm -rf -- "$old_storage"
fi

chmod 700 "$storage"
find "$storage" -maxdepth 1 -type f -exec chmod 600 {} \;
REMOTE_STORAGE_SH

{
  printf "protect .musikkfest-lister/***\n"
  printf "protect */.musikkfest-list\n"
  ssh $SSH_OPTS "$HOST" "cd $REMOTE_TARGET && find . -mindepth 2 -maxdepth 2 -name .musikkfest-list -exec dirname {} \\; | sed 's#^./##' | sort -u" |
    while IFS= read -r route_dir; do
      [ -n "$route_dir" ] && printf "protect %s/***\n" "$route_dir"
    done
} > "$PROTECT_FILE"

rsync -az --delete \
  --filter=". $PROTECT_FILE" \
  --exclude ".git/" \
  --exclude ".gitignore" \
  --exclude ".DS_Store" \
  --exclude "README.md" \
  --exclude "scripts/" \
  --exclude ".musikkfest-lister/" \
  --exclude ".musikkfest-list" \
  --exclude "*/.musikkfest-list" \
  --exclude "*.bak.*" \
  -e "ssh $SSH_OPTS" \
  "$ROOT_DIR/" "$HOST:$TARGET"
