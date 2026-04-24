import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "www");
const entries = ["index.html", "manifest.json", "sw.js", "assets", "src"];

if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const entry of entries) {
  cpSync(join(root, entry), join(outDir, entry), { recursive: true });
}

console.log("Prepared Capacitor web assets in www/");
