#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync, watch } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildArchiveDist } from "./build-archive-dist.mjs";
import { buildHomeDist } from "./build-home-dist.mjs";
import { buildArArchiveDist } from "./build-ar-archive-dist.mjs";
import { buildWorldingDist } from "./build-worlding-dist.mjs";
import { ensureArchiveExportPrereqs } from "./ensure-submodules.mjs";
import { ensureWorldingPython } from "./ensure-worlding-python.mjs";
import { formatLanUrls } from "./lan-address.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const worldingDir = join(root, "apps/worlding");
const archiveDev = process.env.ARCHIVE_DEV !== "0";
const worldingChatPort = Number(
  new URL(process.env.WORLDING_CHAT_URL || "http://127.0.0.1:8080").port || 8080
);
const archiveIndex = join(root, "dist", "archive", "index.html");
const archiveAppDir = join(root, "apps/archive");

function newestSourceMtime(dir) {
  let newest = 0;
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(fullPath);
        continue;
      }
      if (!/\.(tsx?|mjs|css)$/.test(entry.name)) continue;
      newest = Math.max(newest, statSync(fullPath).mtimeMs);
    }
  }
  walk(dir);
  return newest;
}

function warnIfArchiveDistIsStale() {
  if (archiveDev || !existsSync(archiveIndex)) return;
  const distMtime = statSync(archiveIndex).mtimeMs;
  const sourceMtime = newestSourceMtime(archiveAppDir);
  if (sourceMtime <= distMtime) return;

  console.warn("\n⚠️  Archive-Quellcode ist neuer als dist/archive.");
  console.warn("   Neu bauen: npm run build");
  console.warn("   Oder Hot-Reload: npm run dev (Standard)\n");
}

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

function watchWorldingFrontend() {
  const frontendDir = join(root, "apps/worlding/frontend");
  let timer = null;
  watch(frontendDir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log("[worlding] frontend changed — rebuilding dist/worlding…");
      try {
        buildWorldingDist();
      } catch (err) {
        console.error("[worlding] rebuild failed:", err.message);
      }
    }, 300);
  });
}

watchWorldingFrontend();

if (!archiveDev && !existsSync(archiveIndex)) {
  console.log("Building archive → dist/archive…");
  ensureArchiveExportPrereqs();
  execSync("npm run build", {
    cwd: join(root, "apps/archive"),
    stdio: "inherit",
    env: { ...process.env, VERCEL: "1", NODE_ENV: "production" },
  });
  buildArchiveDist();
}

const procs = [];

function shutdown() {
  for (const p of procs) {
    if (!p.killed) p.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (archiveDev) {
  const archiveNextDir = join(root, "apps/archive/.next");
  if (existsSync(archiveNextDir)) {
    console.log("Clearing apps/archive/.next…");
    rmSync(archiveNextDir, { recursive: true, force: true });
  }

  const archive = spawn("npm", ["run", "dev", "--prefix", "apps/archive"], {
    cwd: root,
    env: { ...process.env, PORT: "3001", ARCHIVE_DEV: "1" },
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

  console.log("Starting archive Next.js dev server on :3001…");
  await waitForPort(3001);
}

const worldingPython = ensureWorldingPython();
const worldingChat = spawn(worldingPython, ["dev_server.py"], {
  cwd: worldingDir,
  env: { ...process.env },
  stdio: "inherit",
});

worldingChat.on("exit", (code, sig) => {
  if (sig) return;
  console.error(`[worlding-chat] exited with code ${code}`);
  shutdown();
  process.exit(code ?? 1);
});
procs.push(worldingChat);

console.log(`Waiting for worlding chat on :${worldingChatPort}…`);
await waitForPort(worldingChatPort);

const gateway = spawn("node", ["scripts/gateway.mjs"], {
  cwd: root,
  env: { ...process.env, ARCHIVE_DEV: archiveDev ? "1" : "" },
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
console.log(
  archiveDev
    ? "  /archive     → Next.js :3001 (Hot-Reload)"
    : "  /archive     → dist/archive (statischer Build, kein Hot-Reload)"
);
if (!archiveDev) {
  warnIfArchiveDistIsStale();
}
console.log("  /api/chat    → worlding dev_server :8080 (proxy via Gateway)\n");
