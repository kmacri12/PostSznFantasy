import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seasonPaths } from "./routes";

describe("seasonPaths", () => {
  it("leaves the year out of the current season's addresses", () => {
    const paths = seasonPaths(3, 2026, true);
    expect(paths.home).toBe("/leagues/3");
    expect(paths.draft).toBe("/leagues/3/draft");
    expect(paths.settings).toBe("/leagues/3/settings");
    expect(paths.players).toBe("/leagues/3/players");
    expect(paths.feed).toBe("/leagues/3/feed");
    expect(paths.more).toBe("/leagues/3/more");
    expect(paths.team(7)).toBe("/leagues/3/teams/7");
    expect(paths.teamPoints(7)).toBe("/leagues/3/teams/7/points");
  });

  it("puts the year in any other season's addresses", () => {
    const paths = seasonPaths(3, 2025, false);
    expect(paths.home).toBe("/leagues/3/seasons/2025");
    expect(paths.team(7)).toBe("/leagues/3/seasons/2025/teams/7");
    expect(paths.teamPoints(7)).toBe("/leagues/3/seasons/2025/teams/7/points");
  });
});

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

describe("season links", () => {
  it("are built only by routes.ts and the route table", () => {
    const offenders = sourceFiles(join(__dirname)).filter(
      (file) =>
        !/[\\/](routes|App|SeasonLayout)\.tsx?$/.test(file) &&
        /(?<!api)\/leagues\/[^\n]*\/seasons\//.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => file.slice(__dirname.length))).toEqual([]);
  });
});
