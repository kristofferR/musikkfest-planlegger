# Musikkfest-planlegger

Uoffisiell planlegger for Musikkfest Oslo 2026 med interaktivt program, kart, favoritter og delbare lister.

## Innhold

- `index.html` er hovedappen.
- `api/list.php` lagrer delbare favorittlister.
- `share*.php` og `del*/index.php` håndterer deling, metadata og delingsbilder.
- `musikkfest_2026_og_ekte_artister_1200x630.png` og `musikkfest-map-thumb.png` brukes til previews og genererte bilder.
- `assets/vendor/maplibre-gl/5.12.0/`, `assets/vendor/svgl/` og `assets/fonts/google/` er vendored frontend-avhengigheter som serveres lokalt.

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

## Deploy

Deploy-scriptet synker repoet til produksjonskatalogen pa `suboktav.no`.
Ha SSH-nokkel eller en apen SSH ControlMaster til serveren forst.

```bash
./scripts/deploy.sh
```

Runtime-data for delbare lister ligger utenfor repoet og utenfor webroot pa serveren, og skal ikke committes. Sett `MUSIKKFEST_STORAGE_DIR` hvis lagringskatalogen ma overstyres.
