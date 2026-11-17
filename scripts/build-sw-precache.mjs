/**
 * Genera public/sw-precache.js: el manifiesto versionado que el service
 * worker importa en install para precachear el app shell.
 *
 * Lee el build real (.next/BUILD_ID + .next/static) en vez de hardcodear
 * hashes: cada build produce su propia lista y el SW viejo se purga por
 * version en activate.
 *
 * Uso: `node scripts/build-sw-precache.mjs` (enganchado en `postbuild`,
 * ANTES de copiar public/ al standalone). Nunca lanza: si el build no
 * existe, escribe un manifiesto vacio y el SW usa su lista minima de respaldo.
 */

import { readdirSync, statSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const NEXT_DIR = join(ROOT, ".next");
const STATIC_DIR = join(NEXT_DIR, "static");
const OUT = join(ROOT, "public", "sw-precache.js");

function walk(dir, base = "") {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    try {
      if (statSync(full).isDirectory()) out.push(...walk(full, rel));
      else out.push(rel);
    } catch {
      // Carrera con el FS: ignorar la entrada.
    }
  }
  return out;
}

/** Subconjunto del shell: raiz + layouts + pagina offline + CSS. */
function pickChunks(files) {
  const pick = (re) => files.filter((f) => re.test(f)).map((f) => `/_next/static/${f}`);
  return [
    ...pick(/^chunks\/polyfills-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/webpack-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/main-app-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/framework-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/4bd1b696-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/3794-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/app\/layout-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/app\/\(public\)\/layout-[0-9a-f]+\.js$/),
    ...pick(/^chunks\/app\/\(public\)\/offline\/page-[0-9a-f]+\.js$/),
    ...pick(/^css\/[^/]+\.css$/),
  ];
}

function main() {
  let version = "dev";
  try {
    version = readFileSync(join(NEXT_DIR, "BUILD_ID"), "utf8").trim() || "dev";
  } catch {
    version = "dev";
  }

  const files = existsSync(STATIC_DIR)
    ? walk(STATIC_DIR).map((f) => f.split(sep).join("/"))
    : [];

  const buildManifest = files.find((f) => /_buildManifest\.js$/.test(f));

  const assets = [
    "/offline.html",
    "/manifest.webmanifest",
    "/icon-192.png",
    "/icon-512.png",
    "/apple-touch-icon-180.png",
    "/favicon.ico",
    // Rutas estaticas clave (su HTML queda bajo su propia URL).
    "/",
    "/diccionario",
    "/juegos",
    "/cursos",
    "/offline",
    ...(buildManifest ? [`/_next/static/${buildManifest}`] : []),
    ...pickChunks(files),
  ];

  const body =
    `// Generado por scripts/build-sw-precache.mjs — NO editar a mano.\n` +
    `self.__PIIYAAK_PRECACHE = ${JSON.stringify({ version, assets })};\n`;
  writeFileSync(OUT, body);
  console.log(`[sw-precache] version=${version} assets=${assets.length} -> public/sw-precache.js`);
}

try {
  main();
} catch (err) {
  console.warn("[sw-precache] fallo (SW usara respaldo):", err?.message ?? err);
  try {
    writeFileSync(
      OUT,
      `self.__PIIYAAK_PRECACHE = ${JSON.stringify({ version: "fallback", assets: [] })};\n`
    );
  } catch {
    // Ultimo recurso: ni el respaldo se pudo escribir.
  }
}
