import type { ActivityEvent } from "../../api/types";
import { formatInViewerZone, formatPlainInViewerZone } from "../../utils/timeZone";
import { ROUND_LABELS } from "../team/lineup";

const DRAFT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export const formatWhen = (iso: string): string =>
  formatPlainInViewerZone(iso, {
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

export const settingLabel = (field: string): string => {
  const words = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const settingValue = (value: unknown): string => {
  if (typeof value === "number") return num(value);
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
};

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
    case "league_created":
      return `${who} created the league ${event.payload.leagueName}`;
    case "membership_joined": {
      const { role, teamName } = event.payload;
      const team = teamName ? ` and took ${teamName}` : "";
      return role === "commissioner"
        ? `${who} joined as commissioner${team}`
        : `${who} joined${team}`;
    }
    case "membership_left": {
      const { userId, userName } = event.payload;
      return event.actorUserId === userId || event.actorName === null
        ? `${userName} left the league`
        : `${userName} was removed from the league by ${who}`;
    }
    case "role_changed": {
      const { userName, role } = event.payload;
      if (event.actorName === null) return `${userName} became commissioner`;
      return role === "commissioner"
        ? `${who} made ${userName} a commissioner`
        : `${who} made ${userName} a regular member, no longer a commissioner`;
    }
    case "draft_order_randomized":
      return `${who} randomized the draft order`;
    case "draft_order_changed":
      return `${who} changed the draft order: ${event.payload.moves.map(moveLine).join("; ")}`;
    case "draft_started":
      return `${who} started the draft`;
    case "announcement":
      return `${who} posted an announcement`;
    case "draft_completed":
      return `The draft is complete after ${event.payload.picks} picks`;
    case "draft_time_set": {
      const { startTime, previousStartTime } = event.payload;
      if (startTime === null) return `${who} cleared the draft time`;
      const when = formatInViewerZone(startTime, DRAFT_TIME_FORMAT);
      return previousStartTime === null
        ? `${who} scheduled the draft for ${when}`
        : `${who} moved the draft to ${when}`;
    }
    case "draft_pick_assigned": {
      const { pickNumber, teamName, playerName, scheduled, replacedPlayerName } = event.payload;
      if (replacedPlayerName !== null)
        return `${who} replaced ${replacedPlayerName} with ${playerName} at pick ${pickNumber} (${teamName})`;
      return scheduled
        ? `${who} reserved ${playerName} for pick ${pickNumber} (${teamName})`
        : `${who} assigned ${playerName} to ${teamName} at pick ${pickNumber}`;
    }
  }
};

const moveLine = (move: {
  teamName: string;
  fromPosition: number | null;
  toPosition: number | null;
}): string =>
  move.fromPosition === null
    ? `${move.teamName} was placed at ${move.toPosition}`
    : move.toPosition === null
      ? `${move.teamName} was taken out of slot ${move.fromPosition}`
      : `${move.teamName} moved from ${move.fromPosition} to ${move.toPosition}`;

export const detailLines = (event: ActivityEvent): string[] =>
  event.kind === "settings_change"
    ? event.payload.changes.map(
        (c) => `${settingLabel(c.field)}: ${settingValue(c.before)} → ${settingValue(c.after)}`,
      )
    : [];
