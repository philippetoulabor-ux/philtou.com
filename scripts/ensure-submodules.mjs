import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
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

function isEmptyDir(path) {
  return !existsSync(path) || readdirSync(path).length === 0;
}

/**
 * Archive images live in public/web (git). getProjects() reads database-archive/.
 * Link the two before build/dev so static export and Vercel get real project data.
 */
export function ensureArchiveExportPrereqs() {
  const archiveDir = join(root, "apps/archive");
  const dbArchive = join(archiveDir, "database-archive");
  const web = join(archiveDir, "public/web");
  const thumbs = join(archiveDir, "public/database-archive-thumbs");

  const webReady = existsSync(web) && readdirSync(web).length > 0;

  if (webReady && isEmptyDir(dbArchive)) {
    if (existsSync(dbArchive)) {
      rmSync(dbArchive, { recursive: true, force: true });
    }
    console.log("Linking apps/archive/database-archive → public/web");
    symlinkSync("public/web", dbArchive, "dir");
  } else if (!existsSync(dbArchive)) {
    mkdirSync(dbArchive, { recursive: true });
  }

  if (!existsSync(thumbs)) {
    mkdirSync(thumbs, { recursive: true });
  }
}
