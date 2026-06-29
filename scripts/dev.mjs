#!/usr/bin/env node
import net from "node:net";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHomeDist } from "./build-home-dist.mjs";
import { buildArArchiveDist } from "./build-ar-archive-dist.mjs";
import { buildWorldingDist } from "./build-worlding-dist.mjs";
import { formatLanUrls } from "./lan-address.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function waitForPort(port, host = "127.0.0.1", timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const socket = net.connect(port, host, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

console.log("Building home → dist/home…");
buildHomeDist();

console.log("Building ar-archive → dist/ar-archive…");
buildArArchiveDist();

console.log("Building worlding → dist/worlding…");
buildWorldingDist();

const procs = [];

function shutdown() {
  for (const p of procs) {
    if (!p.killed) p.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const archive = spawn("npm", ["run", "dev", "--prefix", "apps/archive"], {
  cwd: root,
  env: { ...process.env, PORT: "3001" },
  stdio: "inherit",
  shell: process.platform === "win32",
});

archive.on("exit", (code, sig) => {
  if (sig) return;
  console.error(`[archive] exited with code ${code}`);
  shutdown();
  process.exit(code ?? 1);
});
procs.push(archive);

console.log("Waiting for archive on :3001…");
await waitForPort(3001);

const gateway = spawn("node", ["scripts/gateway.mjs"], {
  cwd: root,
  env: { ...process.env },
  stdio: "inherit",
});

gateway.on("exit", (code, sig) => {
  if (sig) return;
  shutdown();
  process.exit(code ?? 1);
});
procs.push(gateway);

console.log("\nOpen http://localhost:3000");
const lan = formatLanUrls(3000);
if (lan.length > 0) {
  console.log(`iPhone (gleiches WLAN): ${lan[0]}`);
}
console.log("");
console.log("  /        → index.html");
console.log("  /home        → dist/home (static)");
console.log("  /ar-archive  → dist/ar-archive (static)");
console.log("  /worlding    → dist/worlding (static)");
console.log("  /archive     → Next.js :3001");
console.log("  /api/chat    → proxy (WORLDING_CHAT_URL, default :8080)\n");
