#!/usr/bin/env node
/**
 * Gateway :3000 — index.html, dist/home, archive proxy.
 */
import {
  createReadStream,
  existsSync,
  statSync,
} from "node:fs";
import http from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.GATEWAY_PORT) || 3000;
const archiveUrl = process.env.ARCHIVE_URL || "http://127.0.0.1:3001";

const indexFile = join(root, "index.html");
const distIndex = join(root, "dist", "index.html");
const homeDir = join(root, "dist", "home");

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
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function serveFile(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, "Not found");
    return;
  }
  const type = MIME[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(res);
}

function serveHome(res, urlPath) {
  if (!existsSync(homeDir)) {
    send(
      res,
      503,
      "Home not built. Run: npm run dev  (or: node scripts/build-home-dist.mjs)"
    );
    return;
  }
  const rel = urlPath.replace(/^\/home\/?/, "") || "index.html";
  const base = normalize(homeDir);
  const safe = normalize(join(homeDir, rel));
  if (!safe.startsWith(base)) {
    send(res, 403, "Forbidden");
    return;
  }
  if (existsSync(safe) && statSync(safe).isFile()) {
    serveFile(res, safe);
    return;
  }
  const index = join(homeDir, "index.html");
  if (existsSync(index)) {
    serveFile(res, index);
    return;
  }
  send(res, 404, "Not found");
}

function proxy(req, res, targetBase) {
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
    send(
      res,
      502,
      `Archive nicht erreichbar (${err.message}). Läuft npm run dev?`
    );
  });
  req.pipe(proxyReq);
}

function route(req, res) {
  const url = req.url?.split("?")[0] ?? "/";

  if (url === "/" || url === "/index.html") {
    if (existsSync(distIndex)) {
      serveFile(res, distIndex);
      return;
    }
    if (existsSync(indexFile)) {
      serveFile(res, indexFile);
      return;
    }
    send(res, 404, "index.html missing");
    return;
  }

  if (url === "/home" || url.startsWith("/home/")) {
    serveHome(res, url);
    return;
  }

  if (
    url === "/archive" ||
    url.startsWith("/archive/") ||
    url.startsWith("/web/") ||
    url === "/pdf.worker.min.mjs" ||
    url.startsWith("/_next/")
  ) {
    proxy(req, res, archiveUrl);
    return;
  }

  send(res, 404, "Not found");
}

http.createServer(route).listen(port, () => {
  console.log(`Gateway http://localhost:${port}`);
});
