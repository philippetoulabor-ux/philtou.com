import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  let html = readFileSync(join(distWorlding, "index.html"), "utf8");
  if (!html.includes('name="zettelkasten-api"')) {
    html = html.replace(
      '<meta name="viewport"',
      '<meta name="zettelkasten-api" content="/api/chat">\n  <meta name="viewport"'
    );
    writeFileSync(join(distWorlding, "index.html"), html);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildWorldingDist();
  console.log("dist/worlding ready.");
}
