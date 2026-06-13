import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const homeDist = join(root, "apps/home/dist");
const distDir = join(root, "dist");
const distHome = join(distDir, "home");

export function buildHomeDist({ copyLanding = false } = {}) {
  execSync("npm run build", { cwd: join(root, "apps/home"), stdio: "inherit" });
  rmSync(distHome, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(homeDist, distHome, { recursive: true });
  if (copyLanding && existsSync(join(root, "index.html"))) {
    cpSync(join(root, "index.html"), join(distDir, "index.html"));
  }
  const previewsDir = join(root, "previews");
  if (copyLanding && existsSync(previewsDir)) {
    cpSync(previewsDir, join(distDir, "previews"), { recursive: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildHomeDist();
  console.log("dist/home ready.");
}
