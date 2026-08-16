/**
 * Encrypt apps/worlding/frontend → outDir/payload.json (+ outDir/enc/*.bin).
 *
 * - index.html → payload.html (ciphertext)
 * - data.json → payload.data (ciphertext)
 * - assets/* → enc/*.bin
 *
 * Password: WORLDING_PASSWORD, else CV_PASSWORD, else first CLI arg.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  cpSync,
} from "node:fs";
import { dirname, join, relative, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  ".json": "application/json",
};

/** Load KEY=VALUE from .env into process.env (does not override existing env). */
export function loadDotEnv() {
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

/**
 * @param {{ frontendDir?: string, outDir?: string, gatePath?: string, password?: string }} [opts]
 */
export async function encryptWorlding(opts = {}) {
  loadDotEnv();
  const frontendDir = opts.frontendDir || join(root, "apps/worlding/frontend");
  const outDir = opts.outDir || join(root, "dist/worlding");
  const gatePath = opts.gatePath || join(root, "worlding/index.html");
  const password =
    opts.password ||
    process.env.WORLDING_PASSWORD ||
    process.env.CV_PASSWORD ||
    process.argv[2];

  if (!password) {
    throw new Error(
      "Set WORLDING_PASSWORD or CV_PASSWORD in .env (or pass the password as the first argument)."
    );
  }

  const htmlPath = join(frontendDir, "index.html");
  const dataPath = join(frontendDir, "data.json");
  if (!existsSync(htmlPath)) {
    throw new Error(`Missing ${htmlPath}`);
  }
  if (!existsSync(dataPath)) {
    throw new Error(`Missing ${dataPath}`);
  }
  if (!existsSync(gatePath)) {
    throw new Error(`Missing gate ${gatePath}`);
  }

  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await deriveKey(password, salt);

  const htmlEnc = await encryptBytes(key, readFileSync(htmlPath));
  const dataEnc = await encryptBytes(key, readFileSync(dataPath));

  rmSync(outDir, { recursive: true, force: true });
  const encDir = join(outDir, "enc");
  mkdirSync(encDir, { recursive: true });

  const assets = {};
  const skip = new Set([htmlPath, dataPath]);
  const files = listFiles(frontendDir).filter((f) => !skip.has(f));
  for (const full of files) {
    const rel = relative(frontendDir, full).split(sep).join("/");
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

  writeFileSync(
    join(outDir, "payload.json"),
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
        data: {
          iv: b64(dataEnc.iv),
          ciphertext: b64(dataEnc.ciphertext),
        },
        assets,
      },
      null,
      2
    ) + "\n"
  );

  cpSync(gatePath, join(outDir, "index.html"));
  console.log(
    `Wrote ${outDir} (${Object.keys(assets).length} assets, encrypted)`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  encryptWorlding().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
