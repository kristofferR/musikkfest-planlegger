import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzip } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { promisify } from "node:util";
import { minify } from "html-minifier-terser";

const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const srcDir = join(rootDir, "src");
const distDir = join(rootDir, "dist");
const gzipAsync = promisify(gzip);

const copyEntries = [
  "api",
  "assets",
  "del",
  "del-bilde",
  "share",
  "share-image",
  "musikkfest-map-thumb.png",
  "musikkfest_2026_og_ekte_artister_1200x630.png",
  "share-data.php",
  "share-image.php",
  "share.php",
];

const scriptEntries = [
  "01-state-and-filters.js",
  "02-routing-and-details.js",
  "03-map.js",
  "04-dom-bindings.js",
  "05-chips-and-share-utils.js",
  "06-favorites-share.js",
  "07-program-render.js",
];

const gzipExtensions = new Set([".css", ".html", ".js", ".json", ".svg"]);
const assetVersionPattern = /\b(href|src)="(\/musikkfest\/assets\/([^"?#]+))"/g;

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index).toLowerCase();
}

async function hashFile(path) {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

async function addAssetVersions(html) {
  const matches = [...html.matchAll(assetVersionPattern)];
  const versions = new Map();
  for (const match of matches) {
    const assetPath = match[3];
    if (!versions.has(assetPath)) {
      versions.set(assetPath, await hashFile(join(rootDir, "assets", assetPath)));
    }
  }
  return html.replace(assetVersionPattern, (full, attr, url, assetPath) => {
    const version = versions.get(assetPath);
    return version ? `${attr}="${url}?v=${version}"` : full;
  });
}

function protectJsonLd(html) {
  const blocks = [];
  const protectedHtml = html.replace(
    /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi,
    (block, json) => {
      const index = blocks.length;
      let replacementJson = json.trim();
      try {
        replacementJson = JSON.stringify(JSON.parse(replacementJson));
      } catch {
        // Keep the original JSON-LD if the source ever contains non-JSON comments or formatting.
      }
      blocks.push(`<script type="application/ld+json">${replacementJson}</script>`);
      return `%%MUSIKKFEST_JSON_LD_${index}%%`;
    },
  );
  return { protectedHtml, blocks };
}

function restoreJsonLd(html, blocks) {
  return blocks.reduce(
    (result, block, index) => result.replace(`%%MUSIKKFEST_JSON_LD_${index}%%`, block),
    html,
  );
}

function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<!--/g, "<\\!--");
}

async function readProgramData() {
  const source = await readFile(join(srcDir, "data", "program.json"), "utf8");
  return JSON.parse(source);
}

function buildDataScript(program) {
  return [
    `const RAW = ${scriptJson(program.events)};`,
    `const EVENT_DETAILS = ${scriptJson(program.eventDetails)};`,
    `const GENRE_LABELS = ${scriptJson(program.genreLabels)};`,
    `const DEFAULT_ARTIST_IMAGE_URL = ${scriptJson(program.defaultArtistImageUrl)};`,
    `const STAGE_LOCATIONS = ${scriptJson(program.stageLocations)};`,
    `const STAGE_MAP_INFO = ${scriptJson(program.stageMapInfo)};`,
  ].join("\n");
}

async function buildAppScript() {
  const program = await readProgramData();
  const sections = await Promise.all(
    scriptEntries.map((entry) => readFile(join(srcDir, "js", entry), "utf8")),
  );
  return [buildDataScript(program), ...sections].join("\n\n");
}

async function buildIndexSource() {
  const [template, styles, appScript] = await Promise.all([
    readFile(join(srcDir, "index.template.html"), "utf8"),
    readFile(join(srcDir, "styles.css"), "utf8"),
    buildAppScript(),
  ]);
  return template
    .replace("%%MUSIKKFEST_CSS%%", styles.trim())
    .replace("%%MUSIKKFEST_APP_JS%%", appScript.trim());
}

async function minifyIndex() {
  const source = await addAssetVersions(await buildIndexSource());
  const { protectedHtml, blocks } = protectJsonLd(source);
  const minified = await minify(protectedHtml, {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    decodeEntities: false,
    keepClosingSlash: true,
    minifyCSS: true,
    minifyJS: {
      compress: {
        passes: 2,
      },
      mangle: true,
      module: false,
    },
    removeAttributeQuotes: false,
    removeComments: true,
    removeEmptyAttributes: false,
    removeOptionalTags: false,
    removeRedundantAttributes: false,
    sortAttributes: false,
    sortClassName: false,
  });
  await writeFile(join(distDir, "index.html"), `${restoreJsonLd(minified, blocks)}\n`);
}

async function copyProductionFiles() {
  for (const entry of copyEntries) {
    await cp(join(rootDir, entry), join(distDir, entry), {
      recursive: true,
      force: true,
      dereference: false,
    });
  }
}

async function copyDataFiles() {
  await cp(join(srcDir, "data"), join(distDir, "data"), {
    recursive: true,
    force: true,
    dereference: false,
  });
}

async function fileSize(path) {
  return (await stat(path)).size;
}

async function sourceBytes() {
  const sourceFiles = [
    join(srcDir, "index.template.html"),
    join(srcDir, "styles.css"),
    join(srcDir, "data", "program.json"),
    ...scriptEntries.map((entry) => join(srcDir, "js", entry)),
  ];
  const sizes = await Promise.all(sourceFiles.map((path) => fileSize(path)));
  return sizes.reduce((total, size) => total + size, 0);
}

async function writeManifest() {
  const [sourceByteCount, distSize] = await Promise.all([
    sourceBytes(),
    fileSize(join(distDir, "index.html")),
  ]);
  const manifest = {
    builtAt: new Date().toISOString(),
    index: {
      sourceBytes: sourceByteCount,
      distBytes: distSize,
      savedBytes: sourceByteCount - distSize,
    },
  };
  await writeFile(join(distDir, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function gzipStaticFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await gzipStaticFiles(path);
      continue;
    }
    if (!entry.isFile() || !gzipExtensions.has(extensionOf(entry.name))) {
      continue;
    }
    const content = await readFile(path);
    const compressed = await gzipAsync(content, { level: 9 });
    if (compressed.length < content.length) {
      await writeFile(`${path}.gz`, compressed);
    }
  }
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyProductionFiles();
await copyDataFiles();
await minifyIndex();
await writeManifest();
await gzipStaticFiles(distDir);
