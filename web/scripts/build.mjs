import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const dist = resolve(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const copyIfExists = (source, target) => {
  if (!existsSync(source)) {
    return;
  }
  cpSync(source, target, { recursive: true });
};

copyIfExists(resolve(root, "src"), dist);
copyIfExists(resolve(root, "data"), resolve(dist, "data"));
copyIfExists(resolve(root, "downloads"), resolve(dist, "downloads"));
copyIfExists(resolve(root, "assets"), resolve(dist, "assets"));
