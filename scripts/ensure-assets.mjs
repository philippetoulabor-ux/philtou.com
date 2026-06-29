#!/usr/bin/env node
/**
 * Prüft Submodule-Assets (Weg A: alles über Git in apps/home + apps/archive).
 * Fallback: rsync von Desktop nur wenn public/web/buttons fehlt.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHomeDist } from "./build-home-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let warnings = 0;

function warn(msg) {
  console.warn(`⚠ ${msg}`);
  warnings++;
}

const archiveDir = join(root, "apps/archive");
const databaseArchive = join(archiveDir, "database-archive");
const webDest = join(archiveDir, "public/web");
const buttonsDir = join(webDest, "buttons");

function archiveAssetsOk() {
  if (existsSync(databaseArchive) && readdirSync(databaseArchive).length > 0) {
    return true;
  }
  return existsSync(buttonsDir) && readdirSync(buttonsDir).length > 0;
}

function runArchiveAssetScript() {
  const pkgPath = join(archiveDir, "package.json");
  if (!existsSync(pkgPath)) return;
  const scripts = JSON.parse(readFileSync(pkgPath, "utf8")).scripts ?? {};
  if (scripts["generate-thumbnails"]) {
    execSync("npm run generate-thumbnails", {
      cwd: archiveDir,
      stdio: "inherit",
    });
  } else if (scripts["manifest:web"]) {
    execSync("npm run manifest:web", { cwd: archiveDir, stdio: "inherit" });
  }
}

if (!archiveAssetsOk()) {
  const fallback = join(
    process.env.HOME ?? "",
    "Desktop",
    "middleman.digital",
    "public",
    "web"
  );
  if (existsSync(fallback)) {
    console.log("Submodule unvollständig — rsync von Desktop…");
    execSync(
      `rsync -a "${fallback}/" "${webDest}/"`,
      { stdio: "inherit" }
    );
    runArchiveAssetScript();
  } else {
    warn(
      "Archive-Assets fehlen (public/web/buttons).\n  git submodule update --init --recursive\n  oder Desktop-Klon nach apps/archive/public/web/ rsyncen."
    );
  }
} else {
  console.log("Archive assets OK (Submodule).");
}

const glb = join(root, "apps/home/public/home-transformed.glb");
const atlas = join(root, "apps/home/public/lightmaps/room-atlas.png");

if (!existsSync(glb)) {
  warn("Home GLB fehlt — git submodule update oder bake-lightmap.");
}
if (!existsSync(atlas)) {
  warn("Lightmap fehlt — git submodule update oder bake-lightmap.");
}

const worldingData = join(root, "apps/worlding/frontend/data.json");
if (!existsSync(worldingData)) {
  warn("Worlding data.json fehlt — git submodule update --init apps/worlding");
}

const arArchiveDir = join(root, "apps/ar-archive");
if (existsSync(join(arArchiveDir, "package.json"))) {
  try {
    execSync("npm run verify", { cwd: arArchiveDir, stdio: "inherit" });
    console.log("AR Archive assets OK (Submodule).");
  } catch {
    warn(
      "AR-Archive-Assets fehlen.\n  git submodule update --init --recursive"
    );
  }
}

console.log("Building home → dist/home…");
try {
  buildHomeDist();
} catch (err) {
  warn(`Home-Build fehlgeschlagen: ${err.message}`);
}

if (warnings > 0) {
  console.warn(`\n${warnings} Hinweis(e).\n`);
} else {
  console.log("Assets OK.\n");
}
