<?php
declare(strict_types=1);

const MF_FAVORITES_PARAM = 'f';
const MF_LIST_PARAM = 'liste';
const MF_LIST_NAME_PARAM = 'navn';
const MF_DEFAULT_LIST_NAME = 'Favoritter';
const MF_PUBLIC_BASE = 'https://suboktav.no/musikkfest';
const MF_MAX_LIST_NAME_LENGTH = 60;
const MF_MAX_SHARE_CODE_LENGTH = 1800;
const MF_MAX_SHARE_CODE_PART_LENGTH = 4;
const MF_MAX_FAVORITES_PER_LIST = 150;
const MF_MAX_STORED_LISTS = 5000;
const MF_SAVE_RATE_WINDOW_SECONDS = 600;
const MF_MAX_SAVE_REQUESTS_PER_WINDOW = 40;

function mf_html_path(): string {
    $indexPath = __DIR__ . '/index.html';
    if (is_file($indexPath)) {
        return $indexPath;
    }
    return __DIR__ . '/Musikkens-dag-2026-Program.html';
}

function mf_program_data_path(): string {
    $paths = [
        __DIR__ . '/data/program.json',
        __DIR__ . '/src/data/program.json',
    ];
    foreach ($paths as $path) {
        if (is_file($path)) {
            return $path;
        }
    }
    return '';
}

function mf_program_data(): array {
    static $program = null;
    if ($program !== null) {
        return $program;
    }

    $path = mf_program_data_path();
    if ($path === '') {
        return $program = [];
    }

    $contents = file_get_contents($path);
    if ($contents === false) {
        return $program = [];
    }

    $json = json_decode($contents, true);
    return $program = is_array($json) ? $json : [];
}

function mf_storage_dir(): string {
    $override = trim((string) (getenv('MUSIKKFEST_STORAGE_DIR') ?: ''));
    if ($override !== '') {
        $dir = $override;
    } else {
        $appDir = __DIR__;
        $siteRoot = dirname($appDir);
        $htdocsDir = dirname($siteRoot);
        $accountRoot = dirname($htdocsDir);
        $dir = basename($htdocsDir) === 'htdocs'
            ? $accountRoot . '/.musikkfest-lister'
            : $siteRoot . '/.musikkfest-lister';
    }
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    @chmod($dir, 0700);
    return $dir;
}

function mf_lists_path(): string {
    return mf_storage_dir() . '/lists.json';
}

function mf_list_lock_path(): string {
    return mf_storage_dir() . '/lists.lock';
}

function mf_rate_limit_path(): string {
    return mf_storage_dir() . '/rate-limits.json';
}

function mf_rate_limit_lock_path(): string {
    return mf_storage_dir() . '/rate-limits.lock';
}

function mf_clean_list_name(?string $raw): string {
    $name = trim((string) $raw);
    $name = preg_replace('/\s+/u', ' ', $name) ?? '';
    if ($name === '') {
        return MF_DEFAULT_LIST_NAME;
    }
    return mb_substr($name, 0, MF_MAX_LIST_NAME_LENGTH, 'UTF-8');
}

function mf_list_name_too_long(?string $raw): bool {
    $name = trim((string) $raw);
    $name = preg_replace('/\s+/u', ' ', $name) ?? '';
    return mb_strlen($name, 'UTF-8') > MF_MAX_LIST_NAME_LENGTH;
}

function mf_slugify(string $name): string {
    $value = mb_strtolower(trim($name), 'UTF-8');
    $value = strtr($value, [
        'æ' => 'ae', 'ø' => 'o', 'å' => 'a',
        'ä' => 'a', 'ö' => 'o', 'ü' => 'u',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'á' => 'a',
        'à' => 'a', 'ó' => 'o', 'ò' => 'o', 'í' => 'i',
        'ì' => 'i', 'ç' => 'c', 'ñ' => 'n',
    ]);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');
    return $value !== '' ? substr($value, 0, 64) : 'liste';
}

function mf_clean_slug(?string $raw): string {
    $slug = strtolower((string) $raw);
    $slug = preg_replace('/[^a-z0-9-]/', '', $slug) ?? '';
    return trim(substr($slug, 0, 80), '-');
}

function mf_reserved_slugs(): array {
    $reserved = [
        'api' => true,
        'del' => true,
        'del-bilde' => true,
        'share' => true,
        'share-image' => true,
        'assets' => true,
        'bilder' => true,
        'kart' => true,
        'favoritter' => true,
        'program' => true,
    ];
    foreach (mf_stage_route_slugs() as $slug) {
        $reserved[$slug] = true;
    }
    return $reserved;
}

function mf_stage_route_slugs(): array {
    $slugs = [];
    foreach (mf_events() as $event) {
        $stage = (string) ($event['stage'] ?? '');
        if ($stage === '') {
            continue;
        }
        $slug = mf_slugify($stage);
        if ($slug !== '') {
            $slugs[$slug] = true;
        }
    }
    return array_keys($slugs);
}

function mf_read_lists_unlocked(): array {
    $path = mf_lists_path();
    if (!is_file($path)) {
        return ['lists' => [], 'tokens' => []];
    }
    $json = json_decode((string) @file_get_contents($path), true);
    if (!is_array($json)) {
        return ['lists' => [], 'tokens' => []];
    }
    return [
        'lists' => is_array($json['lists'] ?? null) ? $json['lists'] : [],
        'tokens' => is_array($json['tokens'] ?? null) ? $json['tokens'] : [],
    ];
}

function mf_write_lists_unlocked(array $store): void {
    $payload = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($payload === false) {
        throw new RuntimeException('Kunne ikke serialisere listelagring.');
    }
    mf_write_file_atomically(mf_lists_path(), $payload . "\n");
}

function mf_read_json_file(string $path): array {
    if (!is_file($path)) {
        return [];
    }
    $json = json_decode((string) @file_get_contents($path), true);
    return is_array($json) ? $json : [];
}

function mf_write_file_atomically(string $path, string $payload): void {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $tmp = $path . '.tmp.' . bin2hex(random_bytes(6));
    if (@file_put_contents($tmp, $payload, LOCK_EX) === false) {
        @unlink($tmp);
        throw new RuntimeException('Kunne ikke skrive lagringsfil.');
    }
    @chmod($tmp, 0600);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Kunne ikke oppdatere lagringsfil.');
    }
    @chmod($path, 0600);
}

function mf_write_json_file(string $path, array $payload): void {
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return;
    }
    mf_write_file_atomically($path, $json . "\n");
}

function mf_rate_limit_key(?string $remoteAddress): string {
    $address = trim((string) $remoteAddress);
    return hash('sha256', $address !== '' ? $address : 'unknown');
}

function mf_save_rate_allowed(string $key, int $now): bool {
    $lock = @fopen(mf_rate_limit_lock_path(), 'c');
    if (!$lock) {
        return true;
    }

    if (!flock($lock, LOCK_EX)) {
        fclose($lock);
        return true;
    }
    try {
        $windowStart = $now - MF_SAVE_RATE_WINDOW_SECONDS;
        $limits = mf_read_json_file(mf_rate_limit_path());
        foreach ($limits as $storedKey => $entry) {
            $startedAt = is_array($entry) ? (int) ($entry['startedAt'] ?? 0) : 0;
            if ($startedAt < $windowStart) {
                unset($limits[$storedKey]);
            }
        }

        $entry = is_array($limits[$key] ?? null) ? $limits[$key] : ['startedAt' => $now, 'count' => 0];
        if ((int) ($entry['startedAt'] ?? 0) < $windowStart) {
            $entry = ['startedAt' => $now, 'count' => 0];
        }
        if ((int) ($entry['count'] ?? 0) >= MF_MAX_SAVE_REQUESTS_PER_WINDOW) {
            mf_write_json_file(mf_rate_limit_path(), $limits);
            return false;
        }

        $entry['count'] = (int) ($entry['count'] ?? 0) + 1;
        $limits[$key] = $entry;
        mf_write_json_file(mf_rate_limit_path(), $limits);
        return true;
    } catch (Throwable) {
        return true;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        @chmod(mf_rate_limit_lock_path(), 0600);
    }
}

function mf_slug_directory(string $slug): string {
    return __DIR__ . '/' . $slug;
}

function mf_slug_available(string $slug, string $token, array $store): bool {
    if ($slug === '' || isset(mf_reserved_slugs()[$slug])) {
        return false;
    }
    $existing = $store['lists'][$slug] ?? null;
    if (is_array($existing) && (($existing['token'] ?? '') !== $token)) {
        return false;
    }
    $dir = mf_slug_directory($slug);
    if (is_dir($dir)) {
        return is_array($existing) && (($existing['token'] ?? '') === $token);
    }
    if (is_file(__DIR__ . '/' . $slug)) {
        return false;
    }
    return true;
}

function mf_unique_slug(string $base, string $token, array $store): string {
    $base = mf_clean_slug($base) ?: 'liste';
    for ($i = 0; $i < 1000; $i++) {
        $slug = $i === 0 ? $base : $base . ($i + 1);
        if (mf_slug_available($slug, $token, $store)) {
            return $slug;
        }
    }
    return $base . '-' . substr($token, 0, 8);
}

function mf_write_slug_route(string $slug): void {
    $dir = mf_slug_directory($slug);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    @file_put_contents($dir . '/.musikkfest-list', $slug . "\n");
    $php = "<?php\n"
        . "declare(strict_types=1);\n\n"
        . '$_GET[' . var_export(MF_LIST_PARAM, true) . '] = ' . var_export($slug, true) . ";\n"
        . "require __DIR__ . '/../share.php';\n";
    @file_put_contents($dir . '/index.php', $php);
    @chmod($dir, 0755);
    @chmod($dir . '/index.php', 0644);
    @chmod($dir . '/.musikkfest-list', 0644);
}

function mf_write_slug_redirect(string $fromSlug, string $toSlug): void {
    $dir = mf_slug_directory($fromSlug);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    @file_put_contents($dir . '/.musikkfest-list', $fromSlug . "\n");
    $target = MF_PUBLIC_BASE . '/' . $toSlug;
    $php = "<?php\n"
        . "declare(strict_types=1);\n\n"
        . 'header("Location: ' . $target . '", true, 301);' . "\n"
        . "exit;\n";
    @file_put_contents($dir . '/index.php', $php);
    @chmod($dir, 0755);
    @chmod($dir . '/index.php', 0644);
    @chmod($dir . '/.musikkfest-list', 0644);
}

function mf_normalize_token(?string $raw): string {
    $token = strtolower((string) $raw);
    return preg_match('/^[a-f0-9]{32}$/', $token) ? $token : bin2hex(random_bytes(16));
}

function mf_share_code_indexes(?string $raw, int $limit = MF_MAX_FAVORITES_PER_LIST): array {
    $code = mf_clean_share_code($raw);
    if ($code === '') {
        return [];
    }

    $events = mf_events();
    if (!$events) {
        return [];
    }

    $seen = [];
    $indexes = [];
    foreach (explode('.', $code) as $part) {
        if ($part === '' || strlen($part) > MF_MAX_SHARE_CODE_PART_LENGTH || !preg_match('/^[0-9a-z]+$/', $part)) {
            continue;
        }
        $index = intval($part, 36);
        if (!isset($events[$index])) {
            continue;
        }
        $eventId = (string) ($events[$index]['id'] ?? '');
        if ($eventId === '' || isset($seen[$eventId])) {
            continue;
        }
        $seen[$eventId] = true;
        $indexes[] = $index;
        if (count($indexes) >= $limit) {
            break;
        }
    }
    return $indexes;
}

function mf_share_code_favorite_count(?string $raw): int {
    return count(mf_share_code_indexes($raw, MF_MAX_FAVORITES_PER_LIST + 1));
}

function mf_canonical_share_code(?string $raw): string {
    $indexes = mf_share_code_indexes($raw);
    return implode('.', array_map(static fn (int $index): string => base_convert((string) $index, 10, 36), $indexes));
}

function mf_save_named_list(?string $tokenRaw, string $nameRaw, string $shareCode): array {
    $name = mf_clean_list_name($nameRaw);
    $base = mf_slugify($name);
    $token = mf_normalize_token($tokenRaw);
    $code = mf_canonical_share_code($shareCode);
    $lock = @fopen(mf_list_lock_path(), 'c');
    if (!$lock) {
        throw new RuntimeException('Kunne ikke låse listelagring.');
    }
    @chmod(mf_list_lock_path(), 0600);

    if (!flock($lock, LOCK_EX)) {
        fclose($lock);
        throw new RuntimeException('Kunne ikke låse listelagring.');
    }
    try {
        $store = mf_read_lists_unlocked();
        $currentSlug = (string) ($store['tokens'][$token] ?? '');
        $current = $currentSlug !== '' && is_array($store['lists'][$currentSlug] ?? null) ? $store['lists'][$currentSlug] : null;
        if (!$current && count($store['lists']) >= MF_MAX_STORED_LISTS) {
            throw new RuntimeException('Listelagring er full.');
        }
        $currentBase = is_array($current) ? (string) ($current['base'] ?? '') : '';
        $slug = ($current && $currentBase === $base) ? $currentSlug : mf_unique_slug($base, $token, $store);

        if ($currentSlug !== '' && $currentSlug !== $slug && is_array($store['lists'][$currentSlug] ?? null)) {
            unset($store['lists'][$currentSlug]);
            mf_write_slug_redirect($currentSlug, $slug);
        }

        $record = [
            'token' => $token,
            'slug' => $slug,
            'base' => $base,
            'name' => $name,
            'code' => $code,
            'updatedAt' => gmdate('c'),
        ];
        $store['lists'][$slug] = $record;
        $store['tokens'][$token] = $slug;
        mf_write_lists_unlocked($store);
        mf_write_slug_route($slug);
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }

    return $record + ['url' => mf_named_share_url($slug)];
}

function mf_named_list(string $slug): ?array {
    $slug = mf_clean_slug($slug);
    if ($slug === '') {
        return null;
    }
    $store = mf_read_lists_unlocked();
    $record = $store['lists'][$slug] ?? null;
    return is_array($record) ? $record : null;
}

function mf_named_share_url(string $slug): string {
    return MF_PUBLIC_BASE . '/' . mf_clean_slug($slug);
}

function mf_event_id(string $time, string $artist, string $genre, string $stage): string {
    return $time . '||' . $artist . '||' . $genre . '||' . $stage;
}

function mf_events(): array {
    static $events = null;
    if ($events !== null) {
        return $events;
    }

    $program = mf_program_data();
    $raw = is_array($program['events'] ?? null) ? $program['events'] : null;

    if ($raw === null) {
        $html = @file_get_contents(mf_html_path());
        if ($html === false) {
            return $events = [];
        }
        if (!preg_match('/const RAW = (\[[\s\S]*?\n\]);/', $html, $match)) {
            return $events = [];
        }

        $raw = json_decode($match[1], true);
    }

    if (!is_array($raw)) {
        return $events = [];
    }

    $events = [];
    foreach ($raw as $row) {
        if (!is_array($row) || count($row) < 4) {
            continue;
        }
        $time = (string) $row[0];
        $artist = (string) $row[1];
        $genre = (string) $row[2];
        $stage = (string) $row[3];
        $objectId = isset($row[4]) ? (string) $row[4] : '';
        $events[] = [
            'id' => $objectId !== '' ? $objectId : mf_event_id($time, $artist, $genre, $stage),
            'time' => $time,
            'artist' => $artist,
            'genre' => $genre,
            'stage' => $stage,
        ];
    }
    return $events;
}

function mf_clean_share_code(?string $raw): string {
    $raw = strtolower((string) $raw);
    $raw = preg_replace('/[^0-9a-z.]/', '', $raw) ?? '';
    return substr($raw, 0, MF_MAX_SHARE_CODE_LENGTH);
}

function mf_minutes(string $time): int {
    if (!preg_match('/^(\d{1,2}):(\d{2})$/', $time, $match)) {
        return 99999;
    }
    return ((int) $match[1]) * 60 + (int) $match[2];
}

function mf_favorite_events(string $shareCode): array {
    $events = mf_events();
    if ($shareCode === '' || !$events) {
        return [];
    }

    $favorites = [];
    foreach (mf_share_code_indexes($shareCode) as $index) {
        $event = $events[$index];
        $favorites[] = $event;
    }

    usort($favorites, static function (array $a, array $b): int {
        return mf_minutes($a['time']) <=> mf_minutes($b['time'])
            ?: strcmp($a['stage'], $b['stage'])
            ?: strcmp($a['artist'], $b['artist']);
    });

    return $favorites;
}

function mf_share_url(string $shareCode, ?string $name = null): string {
    $base = MF_PUBLIC_BASE . '/del/';
    $params = [];
    if ($shareCode !== '') {
        $params[MF_FAVORITES_PARAM] = $shareCode;
    }
    $cleanName = mf_clean_list_name($name);
    if ($cleanName !== MF_DEFAULT_LIST_NAME) {
        $params[MF_LIST_NAME_PARAM] = $cleanName;
    }
    return $params ? $base . '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986) : $base;
}

function mf_app_url(string $shareCode, ?string $name = null, ?string $slug = null): string {
    $base = MF_PUBLIC_BASE . '/';
    $params = [];
    if ($shareCode !== '') {
        $params[MF_FAVORITES_PARAM] = $shareCode;
    }
    $cleanName = mf_clean_list_name($name);
    if ($cleanName !== MF_DEFAULT_LIST_NAME) {
        $params[MF_LIST_NAME_PARAM] = $cleanName;
    }
    $cleanSlug = mf_clean_slug($slug);
    if ($cleanSlug !== '') {
        $params[MF_LIST_PARAM] = $cleanSlug;
    }
    return $base . ($params ? '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986) : '') . '#favoritter';
}

function mf_share_description(array $events, string $name = MF_DEFAULT_LIST_NAME): string {
    if (!$events) {
        return 'Interaktivt program og kart for Musikkfest 2026.';
    }
    $top = array_map(static fn (array $event): string => $event['time'] . ' ' . $event['artist'], array_slice($events, 0, 4));
    $suffix = count($events) > 4 ? ' + ' . (count($events) - 4) . ' til' : '';
    return mf_clean_list_name($name) . ' på Musikkfest 2026: ' . implode(', ', $top) . $suffix;
}

function mf_share_context(): array {
    $slug = mf_clean_slug($_GET[MF_LIST_PARAM] ?? '');
    $record = $slug !== '' ? mf_named_list($slug) : null;
    if ($record) {
        $name = mf_clean_list_name($record['name'] ?? MF_DEFAULT_LIST_NAME);
        $code = mf_clean_share_code($record['code'] ?? '');
        $shareUrl = mf_named_share_url($slug);
        $appUrl = mf_app_url($code, $name, $slug);
        return [
            'name' => $name,
            'code' => $code,
            'slug' => $slug,
            'events' => mf_favorite_events($code),
            'shareUrl' => $shareUrl,
            'appUrl' => $appUrl,
        ];
    }

    $name = mf_clean_list_name($_GET[MF_LIST_NAME_PARAM] ?? MF_DEFAULT_LIST_NAME);
    $code = mf_clean_share_code($_GET[MF_FAVORITES_PARAM] ?? '');
    return [
        'name' => $name,
        'code' => $code,
        'slug' => '',
        'events' => mf_favorite_events($code),
        'shareUrl' => mf_share_url($code, $name),
        'appUrl' => mf_app_url($code, $name),
    ];
}

function mf_display_url(string $url): string {
    $value = preg_replace('#^https?://#', '', $url) ?? $url;
    return rtrim($value, '/');
}
