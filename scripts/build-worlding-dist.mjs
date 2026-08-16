import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const worldingDir = join(root, "worlding");
const distDir = join(root, "dist");
const distWorlding = join(distDir, "worlding");

/**
 * Copy pre-encrypted worlding/ (gate + payload.json + enc/) → dist/worlding.
 * Run `npm run encrypt-worlding` after editing apps/worlding/frontend.
 */
export function buildWorldingDist() {
  const payloadPath = join(worldingDir, "payload.json");
  if (!existsSync(payloadPath)) {
    throw new Error(
      "worlding/payload.json missing — run: npm run encrypt-worlding"
    );
  }
  if (!existsSync(join(worldingDir, "index.html"))) {
    throw new Error("worlding/index.html missing");
  }

  rmSync(distWorlding, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(worldingDir, distWorlding, { recursive: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    buildWorldingDist();
    console.log("dist/worlding ready.");
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
