<?php
declare(strict_types=1);

$query = $_SERVER['QUERY_STRING'] ?? '';
$target = '/musikkfest/del-bilde/' . ($query !== '' ? '?' . $query : '');
header('Location: ' . $target, true, 301);
exit;

