import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function ensureSubmodules() {
  if (!existsSync(join(root, ".gitmodules"))) {
    return;
  }

  const homePkg = join(root, "apps/home/package.json");
  if (existsSync(homePkg)) {
    return;
  }

  console.log("Initializing git submodules…");
  execSync("git submodule update --init --recursive", {
    cwd: root,
    stdio: "inherit",
  });
}

/** database-archive is local-only; export build needs the symlink target to exist. */
export function ensureArchiveExportPrereqs() {
  const archiveDir = join(root, "apps/archive");
  const dbArchive = join(archiveDir, "database-archive");
  const thumbs = join(archiveDir, "public/database-archive-thumbs");

  if (!existsSync(dbArchive)) {
    console.log(
      "Creating apps/archive/database-archive (empty — assets are not in git)…"
    );
    mkdirSync(dbArchive, { recursive: true });
  }

  if (!existsSync(thumbs)) {
    mkdirSync(thumbs, { recursive: true });
  }
}
