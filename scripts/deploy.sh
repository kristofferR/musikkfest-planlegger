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
