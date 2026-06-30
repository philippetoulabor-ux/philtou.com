import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const worlding = join(root, "apps/worlding");
const bundle = join(root, "api/_bundle");

/** Minimal RAG payload for the Vercel Python function (avoids bundling the whole repo). */
export function buildWorldingApiBundle() {
  const backend = join(worlding, "backend");
  const frontend = join(worlding, "frontend");
  const ragIndex = join(frontend, "rag_index.json");

  if (!existsSync(ragIndex)) {
    throw new Error(
      "apps/worlding/frontend/rag_index.json missing — git submodule update --init apps/worlding"
    );
  }

  rmSync(bundle, { recursive: true, force: true });
  mkdirSync(join(bundle, "frontend"), { recursive: true });
  cpSync(backend, join(bundle, "backend"), { recursive: true });
  cpSync(ragIndex, join(bundle, "frontend/rag_index.json"));
  cpSync(join(frontend, "data.json"), join(bundle, "frontend/data.json"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildWorldingApiBundle();
  console.log("api/_bundle ready.");
}
