import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encryptWorlding } from "./encrypt-worlding.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const frontendDir = join(root, "apps/worlding/frontend");
const distWorlding = join(root, "dist", "worlding");

export async function buildWorldingDist() {
  if (!existsSync(join(frontendDir, "index.html"))) {
    throw new Error(
      "apps/worlding/frontend missing — git submodule update --init apps/worlding"
    );
  }

  await encryptWorlding({
    frontendDir,
    outDir: distWorlding,
    gatePath: join(root, "worlding/index.html"),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildWorldingDist()
    .then(() => console.log("dist/worlding ready."))
    .catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
}
