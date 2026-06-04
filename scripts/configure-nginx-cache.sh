#!/bin/sh
set -eu

HOST=${MUSIKKFEST_DEPLOY_HOST:-root@65.21.5.205}
CONTROL=${MUSIKKFEST_DEPLOY_CONTROL:-/tmp/suboktav-root-65.21.5.205.sock}
NGINX_CONF=${MUSIKKFEST_NGINX_CONF:-/etc/nginx/sites-enabled/suboktav.no.conf}
ASSET_DIR=${MUSIKKFEST_ASSET_DIR:-/home/suboktav/htdocs/suboktav.no/musikkfest/assets/}

shell_quote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

if ssh -S "$CONTROL" -o BatchMode=yes -O check "$HOST" >/dev/null 2>&1; then
  SSH_OPTS="-o ControlPath=$CONTROL -o BatchMode=yes"
else
  SSH_OPTS="-o BatchMode=yes"
fi

REMOTE_NGINX_CONF=$(shell_quote "$NGINX_CONF")
REMOTE_ASSET_DIR=$(shell_quote "$ASSET_DIR")

ssh $SSH_OPTS "$HOST" "NGINX_CONF=$REMOTE_NGINX_CONF ASSET_DIR=$REMOTE_ASSET_DIR sh -s" <<'REMOTE_CACHE_SH'
set -eu

if [ ! -f "$NGINX_CONF" ]; then
  echo "Nginx config not found: $NGINX_CONF" >&2
  exit 1
fi

backup="${NGINX_CONF}.bak.$(date +%Y%m%d-%H%M%S)-musikkfest-cache"
block_file=$(mktemp)
next_conf=$(mktemp)
trap 'rm -f "$block_file" "$next_conf"' EXIT

cat > "$block_file" <<CACHE_BLOCK
  # musikkfest-planlegger static cache: start
  location ^~ /musikkfest/assets/ {
    alias ${ASSET_DIR%/}/;
    gzip_static on;
    access_log off;
    try_files \$uri =404;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src https://www.google.com; worker-src 'self' blob:; child-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'; upgrade-insecure-requests" always;
    add_header Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), fullscreen=(self)" always;
    add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy same-origin always;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
  }
  # musikkfest-planlegger static cache: end

CACHE_BLOCK

awk -v block_file="$block_file" '
function print_block() {
  while ((getline line < block_file) > 0) print line
  close(block_file)
}
/musikkfest-planlegger static cache: start/ { skipping = 1; next }
/musikkfest-planlegger static cache: end/ { skipping = 0; next }
!inserted && /^[[:space:]]*location = \/musikkfest\/[[:space:]]*\{/ {
  print_block()
  inserted = 1
}
!skipping { print }
END {
  if (!inserted) exit 2
}
' "$NGINX_CONF" > "$next_conf" || {
  echo "Could not find insertion point for /musikkfest/ cache block." >&2
  exit 1
}

cp "$NGINX_CONF" "$backup"
cat "$next_conf" > "$NGINX_CONF"
if ! nginx -t; then
  cp "$backup" "$NGINX_CONF"
  nginx -t >/dev/null 2>&1 || true
  echo "Nginx config test failed. Restored backup: $backup" >&2
  exit 1
fi

if ! systemctl reload nginx; then
  cp "$backup" "$NGINX_CONF"
  nginx -t >/dev/null 2>&1 || true
  echo "Nginx reload failed. Restored backup: $backup" >&2
  exit 1
fi
printf "%s\n" "$backup"
REMOTE_CACHE_SH
