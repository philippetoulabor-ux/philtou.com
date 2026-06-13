#!/usr/bin/env node
/**
 * Prüft Submodule-Assets (Weg A: alles über Git in apps/home + apps/archive).
 * Fallback: rsync von Desktop nur wenn public/web/buttons fehlt.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHomeDist } from "./build-home-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let warnings = 0;

function warn(msg) {
  console.warn(`⚠ ${msg}`);
  warnings++;
}

const webDest = join(root, "apps/archive/public/web");
const buttonsDir = join(webDest, "buttons");

function webAssetsOk() {
  return existsSync(buttonsDir) && readdirSync(buttonsDir).length > 0;
}

if (!webAssetsOk()) {
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
    execSync("npm run manifest:web", {
      cwd: join(root, "apps/archive"),
      stdio: "inherit",
    });
  } else {
    warn(
      "Archive-Assets fehlen (public/web/buttons).\n  git submodule update --init --recursive\n  oder Desktop-Klon nach apps/archive/public/web/ rsyncen."
    );
  }
} else {
  console.log("Archive web assets OK (Submodule).");
}

const glb = join(root, "apps/home/public/home-transformed.glb");
const atlas = join(root, "apps/home/public/lightmaps/room-atlas.png");

if (!existsSync(glb)) {
  warn("Home GLB fehlt — git submodule update oder bake-lightmap.");
}
if (!existsSync(atlas)) {
  warn("Lightmap fehlt — git submodule update oder bake-lightmap.");
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
