#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveStandaloneServer() {
  if (process.env.STANDALONE_SERVER) {
    return process.env.STANDALONE_SERVER;
  }
  const archive = join(root, "apps/archive");
  const standalone = join(archive, ".next/standalone");
  const nested = join(standalone, "apps/archive", "server.js");
  const flat = join(standalone, "server.js");
  if (existsSync(nested)) return nested;
  if (existsSync(flat)) return flat;
  console.error("Standalone server not found. Run npm run build first.");
  process.exit(1);
}

const server = resolveStandaloneServer();
const serverCwd = dirname(server);

const archiveProc = spawn("node", [server], {
  cwd: serverCwd,
  env: { ...process.env, PORT: "3001", HOSTNAME: "127.0.0.1" },
  stdio: "inherit",
});

function shutdown() {
  archiveProc.kill("SIGTERM");
}

archiveProc.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setTimeout(() => {
  const gateway = spawn("node", ["scripts/gateway.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      ARCHIVE_URL: "http://127.0.0.1:3001",
    },
    stdio: "inherit",
  });

  gateway.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });

  console.log("\nPreview: http://localhost:3000\n");
}, 1500);
