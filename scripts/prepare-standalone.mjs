#!/usr/bin/env node
/**
 * Copies public/ and .next/static into the standalone output after `npm run build`.
 */
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const archive = join(root, "apps/archive");
const standalone = join(archive, ".next/standalone");

const nestedApp = join(standalone, "apps/archive");
const appDir = existsSync(join(nestedApp, "server.js")) ? nestedApp : standalone;

if (!existsSync(join(appDir, "server.js"))) {
  console.error("Run npm run build first.");
  process.exit(1);
}

cpSync(join(archive, "public"), join(appDir, "public"), { recursive: true });
cpSync(join(archive, ".next/static"), join(appDir, ".next/static"), {
  recursive: true,
});

const server = join(appDir, "server.js");
console.log("Standalone bundle ready.");
console.log(`  node ${server}`);
