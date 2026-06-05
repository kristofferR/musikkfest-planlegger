#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
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

if [ "${MUSIKKFEST_SKIP_BUILD:-}" != "1" ]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "bun is required for deploy builds." >&2
    exit 1
  fi
  (cd "$ROOT_DIR" && bun run build)
elif [ ! -d "$DIST_DIR" ]; then
  echo "dist/ does not exist. Run bun run build first, or unset MUSIKKFEST_SKIP_BUILD." >&2
  exit 1
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
owner=$(stat -c '%U:%G' "$site_root")
chown "$owner" "$storage"
find "$storage" -maxdepth 1 -type f -exec chown "$owner" {} \;
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
  --exclude ".DS_Store" \
  --exclude ".musikkfest-lister/" \
  --exclude ".musikkfest-list" \
  --exclude "*/.musikkfest-list" \
  --exclude "*.bak.*" \
  -e "ssh $SSH_OPTS" \
  "$DIST_DIR/" "$HOST:$TARGET"

# rsync -a stamps the deployed tree with the *source* (local) ownership, which
# leaves the webroot un-writable by the site's php-fpm user. The named-list
# feature writes a per-slug index.php into the webroot at save time, so the PHP
# user must own it. Re-chown the webroot (incl. protected slug dirs) to the site
# owner after every deploy.
ssh $SSH_OPTS "$HOST" "TARGET_DIR=$REMOTE_TARGET sh -s" <<'REMOTE_CHOWN_SH'
set -eu
target=${TARGET_DIR%/}
site_root=$(dirname -- "$target")
owner=$(stat -c '%U:%G' "$site_root")
chown -R "$owner" "$target"
REMOTE_CHOWN_SH
