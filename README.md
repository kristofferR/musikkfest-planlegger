# Musikkfest-planlegger

Uoffisiell planlegger for Musikkfest Oslo 2026 med interaktivt program, kart, favoritter og delbare lister.

## Innhold

- `index.html` er hovedappen.
- `api/list.php` lagrer delbare favorittlister.
- `share*.php` og `del*/index.php` håndterer deling, metadata og delingsbilder.
- `musikkfest_2026_og_ekte_artister_1200x630.png` og `musikkfest-map-thumb.png` brukes til previews og genererte bilder.
- `assets/vendor/maplibre-gl/5.12.0/`, `assets/vendor/svgl/` og `assets/fonts/google/` er vendored frontend-avhengigheter som serveres lokalt.
- `scripts/build.mjs` bygger produksjonsfiler til `dist/` med minifisert HTML/CSS/JS, cache-busting på asset-lenker og `.gz`-versjoner av tekstbaserte statiske filer.

## Lokal visning

Kjor en enkel statisk server som server repoet under `/musikkfest`, samme sti som produksjon:

```bash
LOCAL_ROOT=$(mktemp -d)
ln -s "$PWD" "$LOCAL_ROOT/musikkfest"
uv run python -m http.server 8765 -d "$LOCAL_ROOT"
```

Apne deretter:

```text
http://127.0.0.1:8765/musikkfest/
```

Repoets `index.html` er source of truth.

## Build

Installer avhengigheter med Bun og bygg produksjonsmappen:

```bash
bun install
bun run build
```

For å teste bygget lokalt:

```bash
LOCAL_ROOT=$(mktemp -d)
ln -s "$PWD/dist" "$LOCAL_ROOT/musikkfest"
uv run python -m http.server 8766 --bind 127.0.0.1 -d "$LOCAL_ROOT"
```

Apne deretter `http://127.0.0.1:8766/musikkfest/`.

## Deploy

Deploy-scriptet bygger `dist/` og synker bare produksjonsfiler til produksjonskatalogen pa `suboktav.no`.
Ha SSH-nokkel eller en apen SSH ControlMaster til serveren forst.

```bash
./scripts/deploy.sh
```

Sett `MUSIKKFEST_SKIP_BUILD=1` hvis du vil deploye et eksisterende `dist/` uten å bygge på nytt.

For nginx-cache på statiske assets:

```bash
./scripts/configure-nginx-cache.sh
```

Scriptet legger inn en `location ^~ /musikkfest/assets/` med `Cache-Control: public, max-age=31536000, immutable` og `gzip_static on`, tar backup av nginx-configen, kjører `nginx -t` og reloader nginx.

Runtime-data for delbare lister ligger utenfor repoet og utenfor webroot pa serveren, og skal ikke committes. Sett `MUSIKKFEST_STORAGE_DIR` hvis lagringskatalogen ma overstyres.
