#!/usr/bin/env node
// Keeps the first-run tour honest. The tour's screenshots (frontend/public/tour) are taken from
// the real app by `make tour`; this records a hash of the source they were taken from and fails
// when that source has changed since, so a UI change cannot merge with a stale tour.
//
//   node scripts/tour.mjs write   after a capture (make tour does this)
//   node scripts/tour.mjs check   in CI (make tour-check)
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const frontend = path.join(root, "frontend");
const manifestPath = path.join(frontend, "public/tour/manifest.json");
const { paths } = JSON.parse(readFileSync(path.join(frontend, "tour-sources.json"), "utf8"));

const isSource = (file) => /\.(tsx?|svg|css)$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file);

const filesUnder = (target) => {
  if (!existsSync(target)) throw new Error(`tour-sources.json lists ${target}, which is gone`);
  if (statSync(target).isFile()) return [target];
  return readdirSync(target, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter(isSource);
};

const sourceHash = () => {
  const hash = createHash("sha256");
  const files = paths.flatMap((entry) => filesUnder(path.join(frontend, entry))).sort();
  for (const file of files) {
    hash.update(`${path.relative(frontend, file)}\n`);
    hash.update(readFileSync(file, "utf8").replaceAll("\r\n", "\n"));
  }
  return hash.digest("hex");
};

const stepIds = () =>
  [...readFileSync(path.join(frontend, "src/content/rules.ts"), "utf8")
    .split("export const TOUR_STEPS")[1]
    .matchAll(/^\s{4}id: "([a-z-]+)"/gm)].map((match) => match[1]);

const command = process.argv[2];
if (command === "write") {
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ sourceHash: sourceHash(), screens: stepIds() }, null, 2)}\n`,
  );
  console.log(`Wrote ${path.relative(root, manifestPath)}`);
} else if (command === "check") {
  const problems = [];
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  for (const id of stepIds()) {
    if (!existsSync(path.join(frontend, "public/tour", `${id}.jpg`))) {
      problems.push(`the tour step "${id}" has no screenshot (public/tour/${id}.jpg)`);
    }
  }
  if (manifest === null) problems.push("public/tour/manifest.json is missing");
  else if (manifest.sourceHash !== sourceHash()) {
    problems.push(
      "a screen the first-run tour shows has changed since it was captured (see frontend/tour-sources.json)",
    );
  }
  if (problems.length > 0) {
    console.error(`Stale tour:\n- ${problems.join("\n- ")}\nRun \`make tour\` and commit frontend/public/tour.`);
    process.exit(1);
  }
  console.log("The tour matches the app.");
} else {
  console.error("usage: node scripts/tour.mjs write|check");
  process.exit(2);
}
