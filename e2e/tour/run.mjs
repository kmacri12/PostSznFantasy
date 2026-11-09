// Regenerates the first-run tour (frontend/public/tour) from the real app: `make tour`.
// One replayed round per run: the replay file's games are relabelled to that round, then
// Playwright drives the seeded league through it and screenshots each screen.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const here = import.meta.dirname;
const replay = JSON.parse(readFileSync(path.join(here, "../fixtures/replay.json"), "utf8"));
const FIRST_KICKOFF = 1798500000;
const LEAD_SECONDS = 24 * 3600;

const RUNS = [
  { round: "wild-card", label: "Wild Card" },
  { round: "super-bowl", label: "Super Bowl" },
];

// The quiet-opening placeholder game has no teams and no box score, so it is no round's game:
// left in one it would keep that round from ever finishing.
const retime = (game, run) => {
  const placeholder = String(game.gameID).includes("LEAD@");
  const { gameWeek, ...rest } = game;
  return {
    ...rest,
    // A longer quiet opening gives the capture time to draft and set lineups before game one.
    gameTime_epoch: `${placeholder ? FIRST_KICKOFF - LEAD_SECONDS : Number(game.gameTime_epoch)}.0`,
    ...(placeholder ? {} : { gameWeek: run.label }),
  };
};

const only = process.env.TOUR_ONLY;
const dir = mkdtempSync(path.join(tmpdir(), "postszn-tour-"));

for (const run of RUNS) {
  if (only && only !== run.round) continue;
  const games = replay.games.map((game) => retime(game, run));
  const boxes = Object.fromEntries(
    Object.entries(replay.boxes).map(([id, box]) => [id, retime(box, run)]),
  );
  const text = JSON.stringify({ ...replay, games, boxes });
  const file = path.join(dir, `replay-${run.round}.json`);
  writeFileSync(file, text);
  console.log(`\n== Capturing ${run.label} ==`);
  const result = spawnSync("npx", ["playwright", "test", "-c", "playwright.tour.config.ts"], {
    cwd: path.join(here, ".."),
    stdio: "inherit",
    env: { ...process.env, TOUR_ROUND: run.round, TOUR_REPLAY_FILE: file },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
