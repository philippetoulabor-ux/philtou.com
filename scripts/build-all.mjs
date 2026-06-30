import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHomeDist } from "./build-home-dist.mjs";
import { buildArArchiveDist } from "./build-ar-archive-dist.mjs";
import { buildWorldingDist } from "./build-worlding-dist.mjs";
import { buildWorldingApiBundle } from "./build-worlding-api.mjs";
import { buildArchiveDist } from "./build-archive-dist.mjs";
import { ensureArchiveExportPrereqs } from "./ensure-submodules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isVercel = Boolean(process.env.VERCEL);

console.log("Building apps/home…");
buildHomeDist({ copyLanding: true });

console.log("Building apps/ar-archive…");
buildArArchiveDist();

console.log("Building apps/worlding…");
buildWorldingDist();
buildWorldingApiBundle();

ensureArchiveExportPrereqs();

console.log(`Building apps/archive (${isVercel ? "export" : "standalone"})…`);
execSync("npm run build", {
  cwd: join(root, "apps/archive"),
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

if (isVercel) {
  buildArchiveDist();
} else {
  console.log("Preparing standalone bundle…");
  execSync("node scripts/prepare-standalone.mjs", { cwd: root, stdio: "inherit" });
}

console.log(
  isVercel
    ? "Build complete → dist/"
    : "Build complete → dist/ + apps/archive/.next/standalone/"
);
