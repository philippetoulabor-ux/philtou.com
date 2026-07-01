#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const worlding = join(root, "apps/worlding");
const venvPython =
  process.platform === "win32"
    ? join(worlding, ".venv", "Scripts", "python.exe")
    : join(worlding, ".venv", "bin", "python");

export function ensureWorldingPython() {
  if (!existsSync(venvPython)) {
    console.log("Creating worlding Python venv…");
    execSync("python3 -m venv .venv", { cwd: worlding, stdio: "inherit" });
    console.log("Installing worlding Python dependencies…");
    execSync(
      `${venvPython} -m pip install -r requirements.txt -r requirements-dev.txt`,
      { cwd: worlding, stdio: "inherit" }
    );
  }
  return venvPython;
}
