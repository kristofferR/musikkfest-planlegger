import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzip } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { promisify } from "node:util";
import { minify } from "html-minifier-terser";

const rootDir = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
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

async function minifyIndex() {
  const source = await addAssetVersions(await readFile(join(rootDir, "index.html"), "utf8"));
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

async function fileSize(path) {
  return (await stat(path)).size;
}

async function writeManifest() {
  const [sourceSize, distSize] = await Promise.all([
    fileSize(join(rootDir, "index.html")),
    fileSize(join(distDir, "index.html")),
  ]);
  const manifest = {
    builtAt: new Date().toISOString(),
    index: {
      sourceBytes: sourceSize,
      distBytes: distSize,
      savedBytes: sourceSize - distSize,
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
await minifyIndex();
await writeManifest();
await gzipStaticFiles(distDir);
