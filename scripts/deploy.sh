#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
HOST=${MUSIKKFEST_DEPLOY_HOST:-root@65.21.5.205}
TARGET=${MUSIKKFEST_DEPLOY_TARGET:-/home/suboktav/htdocs/suboktav.no/musikkfest/}
CONTROL=${MUSIKKFEST_DEPLOY_CONTROL:-/tmp/suboktav-root-65.21.5.205.sock}

if ssh -S "$CONTROL" -o BatchMode=yes -O check "$HOST" >/dev/null 2>&1; then
  SSH_OPTS="-o ControlPath=$CONTROL -o BatchMode=yes"
else
  SSH_OPTS="-o BatchMode=yes"
fi

rsync -az --delete \
  --exclude ".git/" \
  --exclude ".DS_Store" \
  --exclude ".musikkfest-lister/" \
  --exclude ".musikkfest-list" \
  --exclude "*/.musikkfest-list" \
  --exclude "*.bak.*" \
  -e "ssh $SSH_OPTS" \
  "$ROOT_DIR/" "$HOST:$TARGET"

