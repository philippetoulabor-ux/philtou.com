/**
 * Encrypt cv/private/ → cv/payload.json (+ cv/enc/*.bin for binary assets).
 *
 * - content.html → encrypted HTML body
 * - all other files under cv/private/ → encrypted assets (e.g. PDFs)
 *
 * In content.html reference assets as: asset:relative/path.pdf
 * Password from CV_PASSWORD env or first CLI arg.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const privateDir = join(root, "cv/private");
const htmlPath = join(privateDir, "content.html");
const payloadPath = join(root, "cv/payload.json");
const encDir = join(root, "cv/enc");

/** Load KEY=VALUE from .env into process.env (does not override existing env). */
function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const ITERATIONS = 210_000;
const SALT_LEN = 16;
const IV_LEN = 12;

const MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".html": "text/html",
};

function b64(buf) {
  return Buffer.from(buf).toString("base64");
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

async function encryptBytes(key, bytes) {
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LEN));
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}

async function main() {
  loadDotEnv();
  const password = process.env.CV_PASSWORD || process.argv[2];
  if (!password) {
    console.error("Set CV_PASSWORD in .env or pass the password as the first argument.");
    process.exit(1);
  }
  if (!existsSync(htmlPath)) {
    console.error(`Missing ${htmlPath}`);
    process.exit(1);
  }

  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await deriveKey(password, salt);

  const htmlPlain = readFileSync(htmlPath);
  const htmlEnc = await encryptBytes(key, htmlPlain);

  rmSync(encDir, { recursive: true, force: true });
  mkdirSync(encDir, { recursive: true });

  const assets = {};
  const files = listFiles(privateDir).filter((f) => f !== htmlPath);
  for (const full of files) {
    const rel = relative(privateDir, full).split(sep).join("/");
    const plain = readFileSync(full);
    const { iv, ciphertext } = await encryptBytes(key, plain);
    const binName = `${rel.replace(/[/\\]/g, "__")}.bin`;
    writeFileSync(join(encDir, binName), ciphertext);
    assets[rel] = {
      iv: b64(iv),
      mime: MIME[extname(rel).toLowerCase()] || "application/octet-stream",
      file: `enc/${binName}`,
      bytes: plain.length,
    };
    console.log(`  asset ${rel} (${plain.length} bytes) → enc/${binName}`);
  }

  mkdirSync(dirname(payloadPath), { recursive: true });
  writeFileSync(
    payloadPath,
    JSON.stringify(
      {
        v: 2,
        kdf: "PBKDF2-SHA256",
        iter: ITERATIONS,
        salt: b64(salt),
        html: {
          iv: b64(htmlEnc.iv),
          ciphertext: b64(htmlEnc.ciphertext),
        },
        assets,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Wrote ${payloadPath} (${Object.keys(assets).length} assets)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
