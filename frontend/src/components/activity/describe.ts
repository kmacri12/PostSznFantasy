import type { ActivityEvent } from "../../api/types";
import { ROUND_LABELS } from "../team/lineup";

export const formatWhen = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const slotName = (slot: string | null): string => {
  if (slot === null) return "outside the lineup";
  if (slot === "BENCH") return "the bench";
  return slot === "SUPER_FLEX" ? "SFLX" : slot;
};

const num = (value: number): string => String(Number(value.toFixed(2)));

/** "scoringPassingTd" -> "Scoring passing td" */
export const settingLabel = (field: string): string => {
  const words = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const settingValue = (value: unknown): string => {
  if (typeof value === "number") return num(value);
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
};

/** The one-line sentence for a feed row. */
export const describeEvent = (event: ActivityEvent): string => {
  const who = event.actorName ?? "Someone";
  switch (event.kind) {
    case "lineup_move":
    case "commissioner_override": {
      const p = event.payload;
      const round = ROUND_LABELS[p.round] ?? `Round ${p.round}`;
      const action =
        p.toSlot === null
          ? `took ${p.playerName} out of the ${round} lineup`
          : `moved ${p.playerName} to ${slotName(p.toSlot)} in the ${round} lineup`;
      const swap = p.displaced ? `, swapping out ${p.displaced.playerName}` : "";
      const after = event.kind === "commissioner_override" ? " after kickoff" : "";
      const on = event.teamName && event.actorName !== null ? ` for ${event.teamName}` : "";
      return `${who}${p.byCommissioner ? " (commissioner)" : ""} ${action}${swap}${after}${on}`;
    }
    case "stat_correction": {
      const p = event.payload;
      const round = ROUND_LABELS[p.round] ?? `Round ${p.round}`;
      return `${p.playerName}'s ${round} score changed from ${num(p.previousPoints)} to ${num(p.newPoints)}`;
    }
    case "settings_change":
      return `${who} changed ${event.payload.changes.length === 1 ? "a setting" : `${event.payload.changes.length} settings`}`;
  }
};

/** Extra lines under a settings change: each field with its old and new value. */
export const detailLines = (event: ActivityEvent): string[] =>
  event.kind === "settings_change"
    ? event.payload.changes.map(
        (c) => `${settingLabel(c.field)}: ${settingValue(c.before)} → ${settingValue(c.after)}`,
      )
    : [];
