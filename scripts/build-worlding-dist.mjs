import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const frontendDir = join(root, "apps/worlding/frontend");
const distDir = join(root, "dist");
const distWorlding = join(distDir, "worlding");

export function buildWorldingDist() {
  if (!existsSync(join(frontendDir, "index.html"))) {
    throw new Error(
      "apps/worlding/frontend missing — git submodule update --init apps/worlding"
    );
  }

  rmSync(distWorlding, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(frontendDir, distWorlding, { recursive: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildWorldingDist();
  console.log("dist/worlding ready.");
}
