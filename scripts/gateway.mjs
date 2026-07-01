#!/usr/bin/env node
/**
 * Gateway :3000 — index.html, dist/home, dist/ar-archive, dist/worlding, dist/archive.
 * Default: proxy /archive to Next.js on :3001 (hot-reload).
 * Set ARCHIVE_DEV=0 to serve /archive from dist/ instead.
 */
import {
  createReadStream,
  existsSync,
  statSync,
} from "node:fs";
import http from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { formatLanUrls } from "./lan-address.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.GATEWAY_PORT) || 3000;
const archiveUrl = process.env.ARCHIVE_URL || "http://127.0.0.1:3001";
const archiveDev = process.env.ARCHIVE_DEV !== "0";

const indexFile = join(root, "index.html");
const distDir = join(root, "dist");
const distIndex = join(distDir, "index.html");
const archiveDir = join(distDir, "archive");
const homeDir = join(distDir, "home");
const arArchiveDir = join(root, "dist", "ar-archive");
const worldingDir = join(root, "dist", "worlding");
const previewsDir = join(root, "previews");
const worldingChatUrl =
  process.env.WORLDING_CHAT_URL || "http://127.0.0.1:8080";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".usdz": "model/vnd.usdz+zip",
  ".stl": "model/stl",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function decodeUrlPath(rel) {
  return rel
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

function serveFile(res, filePath, { noCache = false } = {}) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, "Not found");
    return;
  }
  const type = MIME[extname(filePath)] || "application/octet-stream";
  const headers = { "Content-Type": type };
  if (extname(filePath) === ".usdz") {
    headers["Content-Disposition"] = 'inline; filename="model.usdz"';
  }
  if (noCache) {
    headers["Cache-Control"] = "no-store";
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}

function serveStaticApp(res, urlPath, appDir, prefix, buildScript) {
  if (!existsSync(appDir)) {
    send(
      res,
      503,
      `${prefix} not built. Run: npm run dev  (or: node scripts/${buildScript})`
    );
    return;
  }
  const rel = decodeUrlPath(
    urlPath.replace(new RegExp(`^${prefix}\\/?`), "") || "index.html",
  );
  const base = normalize(appDir);
  const safe = normalize(join(appDir, rel));
  if (!safe.startsWith(base)) {
    send(res, 403, "Forbidden");
    return;
  }
  if (existsSync(safe) && statSync(safe).isFile()) {
    serveFile(res, safe);
    return;
  }
  const index = join(appDir, "index.html");
  if (existsSync(index)) {
    serveFile(res, index);
    return;
  }
  send(res, 404, "Not found");
}

function serveHome(res, urlPath) {
  serveStaticApp(res, urlPath, homeDir, "/home", "build-home-dist.mjs");
}

function serveArArchive(res, urlPath) {
  serveStaticApp(
    res,
    urlPath,
    arArchiveDir,
    "/ar-archive",
    "build-ar-archive-dist.mjs"
  );
}

function serveWorlding(res, urlPath) {
  serveStaticApp(res, urlPath, worldingDir, "/worlding", "build-worlding-dist.mjs");
}

const ARCHIVE_ASSET_PREFIXES = [
  ["/_next", "_next"],
  ["/database-archive", "database-archive"],
  ["/database-archive-thumbs", "database-archive-thumbs"],
  ["/web", "web"],
];

function archiveStaticReady() {
  return existsSync(join(archiveDir, "index.html"));
}

function serveDistAsset(res, urlPath, prefix, subdir) {
  const rel = decodeUrlPath(urlPath.slice(prefix.length).replace(/^\//, ""));
  const base = normalize(join(distDir, subdir));
  const safe = normalize(join(base, rel));
  if (!safe.startsWith(base)) {
    send(res, 403, "Forbidden");
    return;
  }
  serveFile(res, safe);
}

function serveArchive(res, urlPath) {
  serveStaticApp(
    res,
    urlPath,
    archiveDir,
    "/archive",
    "build-archive-dist.mjs"
  );
}

function tryServeArchiveStatic(res, url) {
  if (archiveDev || !archiveStaticReady()) {
    return false;
  }

  if (url === "/archive" || url.startsWith("/archive/")) {
    serveArchive(res, url);
    return true;
  }

  for (const [prefix, subdir] of ARCHIVE_ASSET_PREFIXES) {
    if (url === prefix || url.startsWith(`${prefix}/`)) {
      serveDistAsset(res, url, prefix, subdir);
      return true;
    }
  }

  const pdfWorker = join(distDir, "pdf.worker.min.mjs");
  if (url === "/pdf.worker.min.mjs" && existsSync(pdfWorker)) {
    serveFile(res, pdfWorker);
    return true;
  }

  return false;
}

function servePreviews(res, urlPath) {
  const rel = decodeUrlPath(urlPath.replace(/^\/previews\/?/, ""));
  if (!rel) {
    send(res, 404, "Not found");
    return;
  }
  const base = normalize(previewsDir);
  const safe = normalize(join(previewsDir, rel));
  if (!safe.startsWith(base)) {
    send(res, 403, "Forbidden");
    return;
  }
  serveFile(res, safe);
}

function proxy(req, res, targetBase, { label = "Backend" } = {}) {
  const target = new URL(req.url, targetBase);
  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    send(
      res,
      502,
      JSON.stringify({
        error: `${label} nicht erreichbar (${err.message}). Läuft npm run dev?`,
      }),
      "application/json"
    );
  });
  req.pipe(proxyReq);
}

function route(req, res) {
  const url = req.url?.split("?")[0] ?? "/";

  if (url === "/" || url === "/index.html") {
    // Root index.html is source of truth during dev; dist/ is a build snapshot.
    if (existsSync(indexFile)) {
      serveFile(res, indexFile, { noCache: true });
      return;
    }
    if (existsSync(distIndex)) {
      serveFile(res, distIndex, { noCache: true });
      return;
    }
    send(res, 404, "index.html missing");
    return;
  }

  if (url === "/home" || url.startsWith("/home/")) {
    serveHome(res, url);
    return;
  }

  if (url === "/ar-archive" || url.startsWith("/ar-archive/")) {
    serveArArchive(res, url);
    return;
  }

  if (url === "/worlding" || url.startsWith("/worlding/")) {
    serveWorlding(res, url);
    return;
  }

  if (url === "/api/chat") {
    proxy(req, res, worldingChatUrl, { label: "Chat-API" });
    return;
  }

  if (url.startsWith("/previews/")) {
    servePreviews(res, url);
    return;
  }

  if (tryServeArchiveStatic(res, url)) {
    return;
  }

  if (
    url === "/archive" ||
    url.startsWith("/archive/") ||
    url.startsWith("/web/") ||
    url.startsWith("/webdata3d/") ||
    url.startsWith("/database-archive/") ||
    url.startsWith("/database-archive-thumbs/") ||
    url === "/pdf.worker.min.mjs" ||
    url.startsWith("/_next/")
  ) {
    proxy(req, res, archiveUrl, { label: "Archive" });
    return;
  }

  send(res, 404, "Not found");
}

http.createServer(route).listen(port, "0.0.0.0", () => {
  console.log(`Gateway http://localhost:${port}`);
  const lan = formatLanUrls(port);
  if (lan.length > 0) {
    console.log(`  iPhone (WLAN): ${lan.join(", ")}`);
  }
});
