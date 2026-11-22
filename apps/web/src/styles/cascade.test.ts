import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith(".css") ? [full] : [];
  });
}

describe("style cascade", () => {
  it("lists every stylesheet once, in a resolvable order", () => {
    const index = readFileSync(path.join(src, "styles/index.css"), "utf8");
    const imports = [...index.matchAll(/@import "([^"]+)";/g)].map(
      (match) => match[1] ?? "",
    );
    const resolved = imports.map((spec) =>
      path.normalize(path.resolve(path.join(src, "styles"), spec)),
    );
    const owned = cssFiles(src).filter(
      (file) => path.basename(file) !== "index.css",
    );
    expect(new Set(resolved).size).toBe(resolved.length);
    expect(resolved.sort()).toEqual(owned.sort());
  });
});
