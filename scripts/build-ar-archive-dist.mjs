import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arArchiveDist = join(root, "apps/ar-archive/dist");
const distDir = join(root, "dist");
const distArArchive = join(distDir, "ar-archive");

export function buildArArchiveDist() {
  const appDir = join(root, "apps/ar-archive");
  execSync("npm run verify", { cwd: appDir, stdio: "inherit" });
  execSync("npm run build", { cwd: appDir, stdio: "inherit" });
  rmSync(distArArchive, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(arArchiveDist, distArArchive, { recursive: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildArArchiveDist();
  console.log("dist/ar-archive ready.");
}
