<?php
declare(strict_types=1);

require __DIR__ . '/../share-data.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");

const MF_MAX_LIST_REQUEST_BYTES = 8192;

function respond(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > MF_MAX_LIST_REQUEST_BYTES) {
    respond(['ok' => false, 'error' => 'request_too_large'], 413);
}

if (!mf_save_rate_allowed(mf_rate_limit_key($_SERVER['REMOTE_ADDR'] ?? null), time())) {
    header('Retry-After: ' . MF_SAVE_RATE_WINDOW_SECONDS);
    respond(['ok' => false, 'error' => 'rate_limited'], 429);
}

$raw = (string) file_get_contents('php://input');
if (strlen($raw) > MF_MAX_LIST_REQUEST_BYTES) {
    respond(['ok' => false, 'error' => 'request_too_large'], 413);
}

$input = json_decode($raw, true);
if (!is_array($input)) {
    respond(['ok' => false, 'error' => 'invalid_json'], 400);
}

$name = (string) ($input['name'] ?? MF_DEFAULT_LIST_NAME);
if (mf_list_name_too_long($name)) {
    respond(['ok' => false, 'error' => 'name_too_long'], 400);
}

$favoriteCount = mf_share_code_favorite_count($input['f'] ?? '');
if ($favoriteCount === 0) {
    respond(['ok' => false, 'error' => 'empty_list'], 400);
}
if ($favoriteCount > MF_MAX_FAVORITES_PER_LIST) {
    respond(['ok' => false, 'error' => 'too_many_favorites'], 400);
}

$code = mf_canonical_share_code($input['f'] ?? '');

try {
    $record = mf_save_named_list(
        isset($input['token']) ? (string) $input['token'] : null,
        $name,
        $code
    );
    respond([
        'ok' => true,
        'token' => $record['token'],
        'name' => $record['name'],
        'slug' => $record['slug'],
        'url' => $record['url'],
        'f' => $record['code'],
    ]);
} catch (Throwable $error) {
    respond(['ok' => false, 'error' => 'save_failed'], 500);
}
