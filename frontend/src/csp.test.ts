import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Content-Security-Policy", () => {
  it("allows exactly the inline theme script in index.html", () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(read("../index.html"))?.[1] ?? "";
    const hash = createHash("sha256").update(script).digest("base64");
    expect(read("../public/_headers")).toContain(`'sha256-${hash}'`);
  });
});
