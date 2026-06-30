import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const archive = join(root, "apps/archive");
const outDir = join(archive, "out");
const distDir = join(root, "dist");

const REQUIRED_EXPORT_DIRS = ["archive", "_next"];
const OPTIONAL_EXPORT_DIRS = [
  "database-archive-thumbs",
  "web",
  "database-archive",
];

export function buildArchiveDist() {
  if (!existsSync(outDir)) {
    throw new Error("apps/archive/out missing — run next build with output: export");
  }

  for (const name of REQUIRED_EXPORT_DIRS) {
    const src = join(outDir, name);
    if (!existsSync(src)) {
      throw new Error(`apps/archive/out/${name} missing after export build`);
    }
    cpSync(src, join(distDir, name), { recursive: true });
  }

  for (const name of OPTIONAL_EXPORT_DIRS) {
    const src = join(outDir, name);
    if (existsSync(src)) {
      cpSync(src, join(distDir, name), { recursive: true });
    }
  }

  console.log("dist/archive export merged.");
}
