// Regenerates the first-run tour (frontend/public/tour) from the real app: `make tour`.
// The league is last season's real one: build_fixtures.py turns its box scores into a seed and a
// replay file, then Playwright drives a seeded league through the whole postseason and
// screenshots each screen.
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const here = import.meta.dirname;
const dir = mkdtempSync(path.join(tmpdir(), "postszn-tour-"));

const built = spawnSync("python3", [path.join(here, "build_fixtures.py"), dir], {
  stdio: "inherit",
});
if (built.status !== 0) process.exit(built.status ?? 1);

const result = spawnSync("npx", ["playwright", "test", "-c", "playwright.tour.config.ts"], {
  cwd: path.join(here, ".."),
  stdio: "inherit",
  env: { ...process.env, TOUR_FIXTURES_DIR: dir },
});
process.exit(result.status ?? 1);
