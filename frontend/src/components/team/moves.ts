import type { LineupPlayer, RoundLineup } from "../../api/types";
import { BENCH_SLOT, formatKickoff, type Move } from "./lineup";
import { benchPlayersOf, slotNames, startersOf } from "./lineupView";

export interface MoveOption {
  key: string;
  title: string;
  /** Where he goes or what it costs: "WR1 · Sun 6:30 pm", "Empty slot", "FLEX · game started, locked". */
  detail: string;
  /** The word on the button; "Locked" when the option is greyed. */
  action: "Swap" | "Start" | "Bench" | "Override" | "Locked";
  /** Null when the option is greyed; `detail` then says why. */
  move: Move | null;
}

const LOCKED_REASON = "game started, locked";

const FLEX_POSITIONS = ["WR", "RB", "TE"];
const SLOT_POSITIONS: Record<string, string[] | undefined> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  FLEX: FLEX_POSITIONS,
  "W/R": ["WR", "RB"],
  "W/T": ["WR", "TE"],
  SUPER_FLEX: ["QB", ...FLEX_POSITIONS],
  K: ["K"],
  DEF: ["DST"],
};

/** The upstream's spellings for the six positions; the server reads them the same way. */
export const normalizePosition = (position: string): string => {
  const cleaned = position.trim().toUpperCase();
  if (cleaned === "DEF" || cleaned === "D/ST") return "DST";
  if (cleaned === "PK") return "K";
  if (cleaned === "FB") return "RB";
  return cleaned;
};

const canPlay = (slot: string, player: LineupPlayer): boolean =>
  slot === BENCH_SLOT ||
  SLOT_POSITIONS[slot]?.includes(normalizePosition(player.position)) === true;

const gameWhen = (player: LineupPlayer): string => {
  if (player.status === "bye") return "Bye";
  if (player.gameState === "live") return "Live";
  if (player.gameState === "final") return "Final";
  return player.kickoff ? formatKickoff(player.kickoff) : "Game not scheduled";
};

/**
 * Every tap-only move the sheet offers for one player in a round: starting a bench player
 * (into an empty slot or by swapping a starter out), swapping a starter with a bench player,
 * and benching a starter. A locked player cannot move and a swap needs both unlocked; a
 * commissioner may still pick those, and the server asks them to confirm.
 */
export function moveOptions(
  lineup: RoundLineup,
  player: LineupPlayer,
  canOverride: boolean,
): MoveOption[] {
  if (player.status === "eliminated") return [];
  const names = slotNames(lineup);
  const blocks = (other: LineupPlayer | null) => other?.locked === true && !canOverride;
  const lockedAction = canOverride ? "Override" : "Locked";
  const placement = lineup.slots.find((slot) => slot.player?.id === player.id);

  const option = (
    key: string,
    title: string,
    where: string,
    action: "Swap" | "Start" | "Bench",
    move: Move,
    other: LineupPlayer | null,
  ): MoveOption => {
    const locked = player.locked || other?.locked === true;
    if (blocks(player) || blocks(other)) {
      return {
        key,
        title,
        detail: `${where.split(" · ")[0]} · ${LOCKED_REASON}`,
        action: "Locked",
        move: null,
      };
    }
    return { key, title, detail: where, action: locked ? lockedAction : action, move };
  };

  if (placement && placement.slot !== BENCH_SLOT) {
    const emptyBench = lineup.slots.find((slot) => slot.slot === BENCH_SLOT && !slot.player);
    const options = [
      option(
        "bench",
        "Move to bench",
        `Leaves ${names.get(placement.index)}`,
        "Bench",
        { playerId: player.id, slotIndex: emptyBench?.index ?? null },
        null,
      ),
    ];
    for (const other of benchPlayersOf(lineup)) {
      if (!canPlay(placement.slot, other)) continue;
      options.push(
        option(
          `swap-${other.id}`,
          `Swap with ${other.name}`,
          `Bench · ${gameWhen(other)}`,
          "Swap",
          { playerId: other.id, slotIndex: placement.index },
          other,
        ),
      );
    }
    return options;
  }

  return startersOf(lineup)
    .filter((slot) => canPlay(slot.slot, player))
    .map((slot) =>
      slot.player
        ? option(
            `swap-${slot.index}`,
            `Swap with ${slot.player.name}`,
            `${names.get(slot.index)} · ${gameWhen(slot.player)}`,
            "Swap",
            { playerId: player.id, slotIndex: slot.index },
            slot.player,
          )
        : option(
            `start-${slot.index}`,
            `Start at ${names.get(slot.index)}`,
            "Empty slot",
            "Start",
            { playerId: player.id, slotIndex: slot.index },
            null,
          ),
    )
    .sort((a, b) => Number(a.move === null) - Number(b.move === null));
}
