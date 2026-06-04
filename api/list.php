<?php
declare(strict_types=1);

require __DIR__ . '/../share-data.php';

header('Content-Type: application/json; charset=utf-8');

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

$code = mf_clean_share_code($input['f'] ?? '');
if ($code === '') {
    respond(['ok' => false, 'error' => 'empty_list'], 400);
}

try {
    $record = mf_save_named_list(
        isset($input['token']) ? (string) $input['token'] : null,
        (string) ($input['name'] ?? MF_DEFAULT_LIST_NAME),
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
