<?php
declare(strict_types=1);

require __DIR__ . '/share-data.php';

$scriptNonce = bin2hex(random_bytes(16));
header('Cache-Control: no-cache, max-age=0, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, follow');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; script-src 'nonce-" . $scriptNonce . "'; img-src https:; base-uri 'none'; frame-ancestors 'self'; form-action 'none'");

$context = mf_share_context();
$shareCode = $context['code'];
$events = $context['events'];
$listName = $context['name'];
$shareUrl = $context['shareUrl'];
$appUrl = $context['appUrl'];
$imageParams = [];
if ($context['slug'] !== '') {
    $imageParams[MF_LIST_PARAM] = $context['slug'];
} else {
    if ($shareCode !== '') {
        $imageParams[MF_FAVORITES_PARAM] = $shareCode;
    }
    if ($listName !== MF_DEFAULT_LIST_NAME) {
        $imageParams[MF_LIST_NAME_PARAM] = $listName;
    }
}
$imageQuery = http_build_query($imageParams, '', '&', PHP_QUERY_RFC3986);
$imageUrl = 'https://suboktav.no/musikkfest/del-bilde/' . ($imageQuery !== '' ? '?' . $imageQuery : '');
$title = count($events) ? $listName . ' - Musikkfest 2026' : 'Musikkfest 2026 - interaktivt program og kart';
$description = mf_share_description($events, $listName);

function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?><!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?></title>
<link rel="canonical" href="<?= e($shareUrl) ?>">
<meta name="description" content="<?= e($description) ?>">
<meta name="robots" content="noindex,follow">
<meta property="og:locale" content="nb_NO">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Suboktav">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($description) ?>">
<meta property="og:url" content="<?= e($shareUrl) ?>">
<meta property="og:image" content="<?= e($imageUrl) ?>">
<meta property="og:image:secure_url" content="<?= e($imageUrl) ?>">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1350">
<meta property="og:image:alt" content="<?= e($title) ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= e($title) ?>">
<meta name="twitter:description" content="<?= e($description) ?>">
<meta name="twitter:image" content="<?= e($imageUrl) ?>">
<meta name="twitter:image:alt" content="<?= e($title) ?>">
<meta http-equiv="refresh" content="0; url=<?= e($appUrl) ?>">
<script nonce="<?= e($scriptNonce) ?>">location.replace(<?= json_encode($appUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>);</script>
</head>
<body>
<p><a href="<?= e($appUrl) ?>">Åpne favorittlisten</a></p>
</body>
</html>
