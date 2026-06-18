import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHomeDist } from "./build-home-dist.mjs";
import { buildArArchiveDist } from "./build-ar-archive-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("Building apps/home…");
buildHomeDist({ copyLanding: true });

console.log("Building apps/ar-archive…");
buildArArchiveDist();

console.log("Building apps/archive…");
execSync("npm run build", {
  cwd: join(root, "apps/archive"),
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

console.log("Preparing standalone bundle…");
execSync("node scripts/prepare-standalone.mjs", { cwd: root, stdio: "inherit" });

console.log("Build complete → dist/ + apps/archive/.next/standalone/");
