<?php
declare(strict_types=1);

require __DIR__ . '/share-data.php';

const MF_RENDER_SCALE = 2;

function mf_scale(float $value): int {
    return (int) round($value * MF_RENDER_SCALE);
}

function mf_color(GdImage $image, string $hex): int {
    $hex = ltrim($hex, '#');
    return imagecolorallocate($image, hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2)));
}

function mf_font(string $weight = 'regular'): string {
    if ($weight === 'display') {
        $paths = [
            '/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/System/Library/Fonts/SFNS.ttf',
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            '/Library/Fonts/Arial Bold.ttf',
        ];
        foreach ($paths as $path) {
            if (is_file($path)) {
                return $path;
            }
        }
    }
    $paths = $weight === 'bold'
        ? [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf',
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            '/Library/Fonts/Arial Bold.ttf',
        ]
        : ($weight === 'mono'
            ? [
                '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
                '/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf',
                '/System/Library/Fonts/Menlo.ttc',
            ]
            : [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf',
                '/System/Library/Fonts/Supplemental/Arial.ttf',
                '/Library/Fonts/Arial.ttf',
            ]);
    foreach ($paths as $path) {
        if (is_file($path)) {
            return $path;
        }
    }
    return '';
}

function mf_text_width(string $text, int $size, string $font): int {
    if ($font === '') {
        return strlen($text) * imagefontwidth(5);
    }
    $box = imagettfbbox(mf_scale($size), 0, $font, $text);
    return $box ? (int) ceil(abs($box[2] - $box[0]) / MF_RENDER_SCALE) : 0;
}

function mf_fit_text(string $text, int $size, string $font, int $maxWidth): string {
    if (mf_text_width($text, $size, $font) <= $maxWidth) {
        return $text;
    }
    $value = $text;
    while (mb_strlen($value, 'UTF-8') > 1 && mf_text_width($value . '...', $size, $font) > $maxWidth) {
        $value = mb_substr($value, 0, mb_strlen($value, 'UTF-8') - 1, 'UTF-8');
    }
    return $value . '...';
}

function mf_draw_text(GdImage $image, string $text, int $x, int $baseline, int $size, int $color, string $font): void {
    if ($font !== '') {
        imagettftext($image, mf_scale($size), 0, mf_scale($x), mf_scale($baseline), $color, $font, $text);
        return;
    }
    imagestring($image, 5, mf_scale($x), mf_scale($baseline - 16), $text, $color);
}

function mf_round_rect(GdImage $image, int $x, int $y, int $w, int $h, int $r, int $color): void {
    $sx = mf_scale($x);
    $sy = mf_scale($y);
    $sw = mf_scale($w);
    $sh = mf_scale($h);
    $sr = mf_scale($r);
    imagefilledrectangle($image, $sx + $sr, $sy, $sx + $sw - $sr, $sy + $sh, $color);
    imagefilledrectangle($image, $sx, $sy + $sr, $sx + $sw, $sy + $sh - $sr, $color);
    imagefilledellipse($image, $sx + $sr, $sy + $sr, $sr * 2, $sr * 2, $color);
    imagefilledellipse($image, $sx + $sw - $sr, $sy + $sr, $sr * 2, $sr * 2, $color);
    imagefilledellipse($image, $sx + $sr, $sy + $sh - $sr, $sr * 2, $sr * 2, $color);
    imagefilledellipse($image, $sx + $sw - $sr, $sy + $sh - $sr, $sr * 2, $sr * 2, $color);
}

function mf_round_rect_outline(GdImage $image, int $x, int $y, int $w, int $h, int $r, int $color, int $thickness = 2): void {
    $sx = mf_scale($x);
    $sy = mf_scale($y);
    $sw = mf_scale($w);
    $sh = mf_scale($h);
    $sr = mf_scale($r);
    imagesetthickness($image, mf_scale($thickness));
    imageline($image, $sx + $sr, $sy, $sx + $sw - $sr, $sy, $color);
    imageline($image, $sx + $sw, $sy + $sr, $sx + $sw, $sy + $sh - $sr, $color);
    imageline($image, $sx + $sr, $sy + $sh, $sx + $sw - $sr, $sy + $sh, $color);
    imageline($image, $sx, $sy + $sr, $sx, $sy + $sh - $sr, $color);
    imagearc($image, $sx + $sr, $sy + $sr, $sr * 2, $sr * 2, 180, 270, $color);
    imagearc($image, $sx + $sw - $sr, $sy + $sr, $sr * 2, $sr * 2, 270, 360, $color);
    imagearc($image, $sx + $sw - $sr, $sy + $sh - $sr, $sr * 2, $sr * 2, 0, 90, $color);
    imagearc($image, $sx + $sr, $sy + $sh - $sr, $sr * 2, $sr * 2, 90, 180, $color);
}

function mf_draw_image_cover(GdImage $canvas, GdImage $source, int $x, int $y, int $w, int $h): void {
    $sourceW = imagesx($source);
    $sourceH = imagesy($source);
    if ($sourceW <= 0 || $sourceH <= 0) {
        return;
    }
    $scale = max($w / $sourceW, $h / $sourceH);
    $sw = (int) round($w / $scale);
    $sh = (int) round($h / $scale);
    $sx = (int) max(0, round(($sourceW - $sw) / 2));
    $sy = (int) max(0, round(($sourceH - $sh) / 2));
    imagecopyresampled($canvas, $source, mf_scale($x), mf_scale($y), $sx, $sy, mf_scale($w), mf_scale($h), $sw, $sh);
}

function mf_draw_rounded_image_cover(GdImage $canvas, GdImage $source, int $x, int $y, int $w, int $h, int $r): void {
    $sourceW = imagesx($source);
    $sourceH = imagesy($source);
    if ($sourceW <= 0 || $sourceH <= 0) {
        return;
    }
    $destW = mf_scale($w);
    $destH = mf_scale($h);
    $radius = mf_scale($r);
    $scale = max($w / $sourceW, $h / $sourceH);
    $sw = (int) round($w / $scale);
    $sh = (int) round($h / $scale);
    $sx = (int) max(0, round(($sourceW - $sw) / 2));
    $sy = (int) max(0, round(($sourceH - $sh) / 2));
    $temp = imagecreatetruecolor($destW, $destH);
    imagecopyresampled($temp, $source, 0, 0, $sx, $sy, $destW, $destH, $sw, $sh);
    $canvasX = mf_scale($x);
    $canvasY = mf_scale($y);
    $radiusSquared = $radius * $radius;
    for ($py = 0; $py < $destH; $py++) {
        for ($px = 0; $px < $destW; $px++) {
            $inside = ($px >= $radius && $px <= $destW - $radius)
                || ($py >= $radius && $py <= $destH - $radius);
            if (!$inside) {
                $cx = $px < $radius ? $radius : $destW - $radius;
                $cy = $py < $radius ? $radius : $destH - $radius;
                $dx = $px - $cx;
                $dy = $py - $cy;
                $inside = ($dx * $dx + $dy * $dy) <= $radiusSquared;
            }
            if ($inside) {
                imagesetpixel($canvas, $canvasX + $px, $canvasY + $py, imagecolorat($temp, $px, $py));
            }
        }
    }
}

function mf_draw_map_inset(GdImage $image, int $x, int $y, int $w, int $h, int $fallback, int $border): void {
    mf_round_rect($image, $x, $y, $w, $h, 22, $fallback);
    $path = __DIR__ . '/musikkfest-2026-map-thumb.png';
    $data = is_file($path) ? @file_get_contents($path) : false;
    $map = $data !== false ? @imagecreatefromstring($data) : false;
    if ($map instanceof GdImage) {
        mf_draw_rounded_image_cover($image, $map, $x, $y, $w, $h, 22);
    }
    mf_round_rect_outline($image, $x, $y, $w, $h, 22, $border, 2);
}

$context = mf_share_context();
$shareCode = $context['code'];
$events = $context['events'];
$listName = $context['name'];
$shareUrl = $context['shareUrl'];

$width = 1080;
$height = 1350;
$image = imagecreatetruecolor(mf_scale($width), mf_scale($height));
imageantialias($image, true);

$ink = mf_color($image, '#1a1814');
$paper = mf_color($image, '#f5f3ee');
$muted = mf_color($image, '#6b6760');
$faint = mf_color($image, '#a8a49e');
$white = mf_color($image, '#ffffff');
$rowAlt = mf_color($image, '#faf9f7');
$mapFallback = mf_color($image, '#f3efe6');
$border = imagecolorallocatealpha($image, 26, 24, 20, 108);

$font = mf_font('regular');
$bold = mf_font('bold');
$display = mf_font('display');
$mono = mf_font('mono');

imagefilledrectangle($image, 0, 0, mf_scale($width), mf_scale($height), $ink);
mf_round_rect($image, 48, 48, 984, 1254, 30, $paper);

mf_draw_text($image, 'Musikkfest 2026', 86, 132, 52, $ink, $display);
mf_draw_text($image, mf_fit_text($listName, 31, $bold, 560), 90, 188, 31, $ink, $bold);
mf_draw_text($image, count($events) ? count($events) . ' favoritter' : 'Ingen favoritter ennå', 90, 244, 22, $muted, $mono);

mf_draw_map_inset($image, 682, 82, 320, 180, $mapFallback, $border);

$visible = array_slice($events, 0, 20);
$startY = 326;
$bottomY = 1202;
$rowGap = 8;
$columns = count($visible) <= 10 ? 1 : 2;
$rowsPerColumn = max(1, (int) ceil(count($visible) / $columns));
$rowHeight = (int) floor(($bottomY - $startY - ($rowsPerColumn - 1) * $rowGap) / $rowsPerColumn);
$leftX = 86;
$columnGap = 36;
$columnWidth = $columns === 1 ? 888 : 426;
$timeWidth = $columns === 1 ? 118 : 96;
$artistFont = $columns === 1 ? 25 : 17;
$stageFont = $columns === 1 ? 18 : 13;
$timeFont = $columns === 1 ? 21 : 14;

if (!$visible) {
    mf_round_rect($image, $leftX, $startY, 888, 150, 22, $white);
    mf_draw_text($image, 'Trykk stjerne i programmet for å bygge listen.', 116, $startY + 88, 25, $muted, $bold);
}

foreach ($visible as $index => $event) {
    $col = $columns === 1 ? 0 : ($index >= $rowsPerColumn ? 1 : 0);
    $row = $columns === 1 ? $index : $index % $rowsPerColumn;
    $x = $leftX + $col * ($columnWidth + $columnGap);
    $y = $startY + $row * ($rowHeight + $rowGap);
    $mainX = $x + $timeWidth;
    $mainWidth = $columnWidth - $timeWidth - 18;

    mf_round_rect($image, $x, $y, $columnWidth, $rowHeight, 14, $index % 2 === 0 ? $white : $rowAlt);
    mf_draw_text($image, $event['time'], $x + 16, $y + (int) round($rowHeight * 0.58), $timeFont, $faint, $mono);
    mf_draw_text($image, mf_fit_text($event['artist'], $artistFont, $bold, $mainWidth), $mainX, $y + (int) round($rowHeight * 0.45), $artistFont, $ink, $bold);
    mf_draw_text($image, mf_fit_text($event['stage'], $stageFont, $font, $mainWidth), $mainX, $y + (int) round($rowHeight * 0.73), $stageFont, $muted, $font);
}

if (count($events) > count($visible)) {
    mf_draw_text($image, '+ ' . (count($events) - count($visible)) . ' til i lenken', 86, 1230, 20, $muted, $bold);
}

mf_draw_text($image, mf_fit_text(mf_display_url($shareUrl), 23, $bold, 888), 86, 1260, 23, $ink, $bold);

header('Content-Type: image/png');
header('Cache-Control: public, max-age=300, stale-while-revalidate=86400');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
header("Content-Security-Policy: default-src 'none'; img-src 'self' data:");
$output = imagecreatetruecolor($width, $height);
imagecopyresampled($output, $image, 0, 0, 0, 0, $width, $height, imagesx($image), imagesy($image));
imagepng($output, null, 9);
