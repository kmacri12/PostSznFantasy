import type { LeagueSettings } from "../../api/types";
import { ROSTER_GROUPS } from "../../settings/rosterGroups";

export interface SlotCount {
  label: string;
  count: number;
}

export interface PositionCap {
  position: string;
  /** Null means no limit. */
  max: number | null;
}

const count = (settings: LeagueSettings, key: string): number => {
  const value = settings[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())];
  return typeof value === "number" ? value : 0;
};

const STARTER_GROUP = ROSTER_GROUPS[0];
const LIMIT_GROUP = ROSTER_GROUPS[1];

/** Starter slots with at least one spot, in lineup order; the bench comes last. */
export function startingSlots(settings: LeagueSettings): { starters: SlotCount[]; bench: number } {
  const entries = (STARTER_GROUP?.fields ?? []).map((field) => ({
    key: field.key,
    label: field.label,
    count: count(settings, field.key),
  }));
  return {
    starters: entries.filter((e) => e.key !== "roster_num_bench" && e.count > 0),
    bench: entries.find((e) => e.key === "roster_num_bench")?.count ?? 0,
  };
}

/** Per-position draft caps. A cap that can never bind (roster size or more) reads as no limit. */
export function positionCaps(settings: LeagueSettings): PositionCap[] {
  const total = count(settings, "roster_total");
  return (LIMIT_GROUP?.fields ?? []).map((field) => {
    const max = count(settings, field.key);
    return {
      position: field.label.replace("Max ", ""),
      max: max >= total ? null : max,
    };
  });
}
