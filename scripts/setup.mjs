#!/usr/bin/env node
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("Installing root dependencies…");
execSync("npm install", { cwd: root, stdio: "inherit" });

console.log("Installing apps/home…");
execSync("npm install", { cwd: join(root, "apps/home"), stdio: "inherit" });

console.log("Installing apps/archive…");
execSync("npm install", { cwd: join(root, "apps/archive"), stdio: "inherit" });

console.log("Installing apps/ar-archive…");
execSync("npm install", { cwd: join(root, "apps/ar-archive"), stdio: "inherit" });

console.log("Setup complete. Run: npm run dev");
