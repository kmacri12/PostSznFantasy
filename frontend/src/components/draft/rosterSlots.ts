import type { DraftPick, LeagueSettings } from "../../api/types";

export interface RosterSlot {
  label: string;
  pick: DraftPick | null;
}

export interface DraftRoster {
  starters: RosterSlot[];
  bench: RosterSlot[];
  filledStarters: number;
}

const STARTER_SLOTS: { setting: string; label: string; eligible: string[] }[] = [
  { setting: "rosterNumQb", label: "QB", eligible: ["QB"] },
  { setting: "rosterNumRb", label: "RB", eligible: ["RB"] },
  { setting: "rosterNumWr", label: "WR", eligible: ["WR"] },
  { setting: "rosterNumTe", label: "TE", eligible: ["TE"] },
  { setting: "rosterNumFlexWrRbTe", label: "FLEX", eligible: ["RB", "WR", "TE"] },
  { setting: "rosterNumFlexWrRb", label: "FLEX", eligible: ["RB", "WR"] },
  { setting: "rosterNumFlexWrTe", label: "FLEX", eligible: ["WR", "TE"] },
  { setting: "rosterNumFlexQbWrRbTe", label: "SUPERFLEX", eligible: ["QB", "RB", "WR", "TE"] },
  { setting: "rosterNumK", label: "K", eligible: ["K"] },
  { setting: "rosterNumDst", label: "DST", eligible: ["DST"] },
];

const slotCount = (settings: LeagueSettings, key: string): number => Number(settings[key]) || 0;

/**
 * A team's drafted players in the league's roster slots. Position slots fill first, then
 * flex slots, and whoever is left sits on the bench; picks fill in draft order.
 */
export function draftRoster(settings: LeagueSettings, picks: DraftPick[]): DraftRoster {
  const slots = STARTER_SLOTS.flatMap((def) =>
    Array.from({ length: slotCount(settings, def.setting) }, () => ({
      label: def.label,
      eligible: def.eligible,
      pick: null as DraftPick | null,
    })),
  );
  const unplaced: DraftPick[] = [];
  const ordered = [...picks].sort((a, b) => a.numberPickOverall - b.numberPickOverall);
  const fill = (pick: DraftPick, accept: (eligible: string[]) => boolean) => {
    const slot = slots.find(
      (candidate) =>
        candidate.pick === null &&
        accept(candidate.eligible) &&
        candidate.eligible.includes(pick.position ?? ""),
    );
    if (slot) slot.pick = pick;
    return slot !== undefined;
  };
  const afterDedicated = ordered.filter((pick) => !fill(pick, (eligible) => eligible.length === 1));
  for (const pick of afterDedicated) if (!fill(pick, () => true)) unplaced.push(pick);

  const benchSize = slotCount(settings, "rosterNumBench");
  const bench: RosterSlot[] = Array.from({ length: benchSize }, (_, index) => ({
    label: "BN",
    pick: unplaced[index] ?? null,
  }));
  // A roster larger than its slots (settings edited after picks) still shows every player.
  for (const pick of unplaced.slice(benchSize)) bench.push({ label: "BN", pick });
  return {
    starters: slots.map(({ label, pick }) => ({ label, pick })),
    bench,
    filledStarters: slots.filter((slot) => slot.pick !== null).length,
  };
}
