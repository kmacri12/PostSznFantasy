import type { PlayerSeasonLine } from "../../api/types";
import { normalizePosition } from "./moves";

export interface StatRow {
  label: string;
  value: string;
}

const num = (line: PlayerSeasonLine, key: string): number => {
  const value = line[key];
  return typeof value === "number" ? value : 0;
};

const grouped = (value: number) => value.toLocaleString("en-US");

/** The fields of one stat row joined with " · ", skipping touchdown counts of zero. */
const parts = (...pieces: (string | null)[]) => pieces.filter(Boolean).join(" · ");

const rushing = (line: PlayerSeasonLine): StatRow => ({
  label: "Rushing",
  value: parts(
    `${grouped(num(line, "rushingCarries"))} car`,
    `${grouped(num(line, "rushingYards"))} yds`,
    `${num(line, "rushingTouchdowns")} TD`,
  ),
});

const receiving = (line: PlayerSeasonLine): StatRow => ({
  label: "Receiving",
  value: parts(
    `${grouped(num(line, "receivingReceptions"))} rec`,
    `${grouped(num(line, "receivingYards"))} yds`,
    `${num(line, "receivingTouchdowns")} TD`,
  ),
});

/** The stat rows the sheet shows for a position: the few that matter, never the whole table. */
export function seasonRows(position: string, line: PlayerSeasonLine): StatRow[] {
  switch (normalizePosition(position)) {
    case "QB": {
      const rows: StatRow[] = [
        {
          label: "Passing",
          value: parts(
            `${num(line, "passingCompletions")}/${num(line, "passingAttempts")}`,
            `${grouped(num(line, "passingYards"))} yds`,
            `${num(line, "passingTouchdowns")} TD`,
            `${num(line, "passingInterceptions")} INT`,
          ),
        },
      ];
      if (num(line, "rushingYards") || num(line, "rushingTouchdowns")) {
        rows.push({
          label: "Rushing",
          value: parts(
            `${grouped(num(line, "rushingYards"))} yds`,
            `${num(line, "rushingTouchdowns")} TD`,
          ),
        });
      }
      return rows;
    }
    case "RB":
      return [rushing(line), receiving(line)];
    case "WR":
    case "TE":
      return num(line, "rushingCarries") ? [receiving(line), rushing(line)] : [receiving(line)];
    case "K": {
      const fgMade = num(line, "kickingFgMade");
      const xpMade = num(line, "kickingXpMade");
      return [
        {
          label: "Kicking",
          value: parts(
            `${fgMade}/${fgMade + num(line, "kickingFgMissed")} FG`,
            `${xpMade}/${xpMade + num(line, "kickingXpMissed")} XP`,
          ),
        },
      ];
    }
    case "DST":
      return [
        {
          label: "Defense",
          value: parts(
            `${num(line, "dstSacks")} sacks`,
            `${num(line, "dstInterceptions")} INT`,
            `${num(line, "dstFumblesRecovered")} FR`,
            `${num(line, "dstDefTd")} TD`,
          ),
        },
      ];
    default:
      return [];
  }
}
