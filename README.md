# Musikkfest-planlegger

Uoffisiell planlegger for Musikkfest Oslo 2026 med interaktivt program, kart, favoritter og delbare lister.

## Innhold

- `src/` er kildekoden for hovedappen: HTML-template, CSS, JS-seksjoner og programdata.
- `dist/` genereres av `bun run build` og er det som deployes.
- `api/list.php` lagrer delbare favorittlister.
- `share*.php` og `del*/index.php` håndterer deling, metadata og delingsbilder.
- `musikkfest-2026-preview.png` og `musikkfest-2026-map-thumb.png` brukes til previews og genererte bilder.
- `assets/vendor/maplibre-gl/5.12.0/`, `assets/vendor/svgl/` og `assets/fonts/google/` er vendored frontend-avhengigheter som serveres lokalt.
- `scripts/build.mjs` bygger produksjonsfiler til `dist/` med minifisert HTML/CSS/JS, cache-busting på asset-lenker og `.gz`-versjoner av tekstbaserte statiske filer.

## Lokal visning

Bygg appen forst:

```bash
bun run build
```

Kjor deretter en enkel statisk server som server `dist/` under `/musikkfest`, samme sti som produksjon:

```bash
LOCAL_ROOT=$(mktemp -d)
ln -s "$PWD/dist" "$LOCAL_ROOT/musikkfest"
uv run python -m http.server 8765 -d "$LOCAL_ROOT"
```

Apne deretter:

```text
http://127.0.0.1:8765/musikkfest/
```

Repoets `src/` er source of truth. `index.html` i rotkatalogen er bare en kort utviklerbeskjed.

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

Deploy-scriptet bygger `dist/` og synker bare produksjonsfiler til `/path/to/www/musikkfest/` på serveren (server), som serveres på https://suboktav.no/musikkfest/.
Ha SSH-nøkkel eller en åpen SSH ControlMaster til serveren først.

```bash
./scripts/deploy.sh
```

Sett `MUSIKKFEST_SKIP_BUILD=1` hvis du vil deploye et eksisterende `dist/` uten å bygge på nytt.

Serveren kjører Caddy og PHP-FPM. Caddy-configen (snippeten `musikkfest` i `/etc/caddy/Caddyfile` på serveren) setter sikkerhetsheadere og `Cache-Control` for assets, og serverer de ferdigkomprimerte `.gz`-filene.

Runtime-data for delbare lister ligger i `/path/to/data/musikkfest` på serveren, utenfor repoet og webroot, og skal ikke committes. Sett `MUSIKKFEST_STORAGE_DIR` hvis lagringskatalogen må overstyres.

## Lisens

Lisensiert under [GNU General Public License v3.0 eller senere](LICENSE) (GPL-3.0-or-later).
