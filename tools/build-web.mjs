import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const output = join(root, "www");
const entries = ["index.html", "styles.css", "src"];

if (existsSync(output)) rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const entry of entries) {
  cpSync(join(root, entry), join(output, entry), { recursive: true });
}

console.log("Built Capacitor web assets in www/");
