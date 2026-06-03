# Musikkfest-planlegger

Uoffisiell planlegger for Musikkfest Oslo 2026 med interaktivt program, kart, favoritter og delbare lister.

## Innhold

- `index.html` er hovedappen.
- `api/list.php` lagrer delbare favorittlister.
- `share*.php` og `del*/index.php` håndterer deling, metadata og delingsbilder.
- `musikkfest_2026_og_ekte_artister_1200x630.png` og `musikkfest-map-thumb.png` brukes til previews og genererte bilder.

## Lokal visning

Kjor en enkel statisk server fra repo-roten:

```bash
python3 -m http.server 8765
```

Apne deretter:

```text
http://127.0.0.1:8765/
```

Repoets `index.html` er source of truth. Den gamle lokale filen i Downloads peker til denne filen via symlink.

## Deploy

Deploy-scriptet synker repoet til produksjonskatalogen pa `suboktav.no`.
Ha SSH-nokkel eller en apen SSH ControlMaster til serveren forst.

```bash
./scripts/deploy.sh
```

Runtime-data for delbare lister ligger utenfor repoet pa serveren og skal ikke committes.
