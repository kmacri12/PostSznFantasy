import type { DraftPick, PickSource } from "../../api/types";

/** Board legend wording, in the order the legend lists them. A manager's own pick has no badge. */
export const SOURCE_LEGEND: Record<Exclude<PickSource, "manager">, string> = {
  timer: "Time ran out",
  autopilot: "Autopilot",
  no_owner: "No manager",
  commissioner_auto: "Commissioner's auto-pick",
  commissioner_assigned: "Commissioner's pick",
};

/** The pick sheet's full sentence on how the pick was made. */
export const sourceDetail = (source: PickSource): string => {
  switch (source) {
    case "manager":
      return "Picked by the manager";
    case "timer":
      return "Auto-picked: time ran out";
    case "autopilot":
      return "Auto-picked: the team was on autopilot";
    case "no_owner":
      return "Auto-picked: the team has no manager";
    case "commissioner_auto":
      return "Commissioner action · auto-picked (Auto-pick now)";
    case "commissioner_assigned":
      return "Commissioner action · picked for the team";
  }
};

/** Badged sources present on the board, so the legend lists only what is there. */
export const sourcesOnBoard = (picks: DraftPick[]): Exclude<PickSource, "manager">[] => {
  const present = new Set(picks.map((pick) => pick.source));
  return (Object.keys(SOURCE_LEGEND) as Exclude<PickSource, "manager">[]).filter((source) =>
    present.has(source),
  );
};

/**
 * The toast for a pick, or null when nobody needs telling. The drafter hears about every pick
 * made for them; everyone hears when the commissioner made or forced a pick.
 */
export const pickToast = (
  pick: DraftPick,
  myTeamId: number | null,
  teamName: string,
): string | null => {
  const player = pick.playerName ?? "a player";
  const mine = pick.teamId === myTeamId;
  const forWhom = mine ? "you" : teamName;
  switch (pick.source) {
    case "commissioner_auto":
      return `The commissioner auto-picked ${player} for ${forWhom}`;
    case "commissioner_assigned":
      return `The commissioner picked ${player} for ${forWhom}`;
    case "timer":
      return mine ? `Time ran out: ${player} was auto-picked for you` : null;
    case "autopilot":
      return mine ? `Autopilot drafted ${player} for you` : null;
    case "no_owner":
    case "manager":
      return null;
  }
};

/** The screen reader's sentence for a pick, which says who made it when it was not the manager. */
export const pickSentence = (pick: DraftPick, teamName: string): string => {
  const player = pick.playerName ?? "a player";
  const prefix = `Pick ${pick.numberPickOverall}:`;
  switch (pick.source) {
    case "commissioner_auto":
      return `${prefix} the commissioner auto-picked ${player} for ${teamName}`;
    case "commissioner_assigned":
      return `${prefix} the commissioner picked ${player} for ${teamName}`;
    case "timer":
      return `${prefix} time ran out, ${player} was auto-picked for ${teamName}`;
    case "autopilot":
      return `${prefix} autopilot took ${player} for ${teamName}`;
    case "no_owner":
      return `${prefix} ${player} was auto-picked for ${teamName}, which has no manager`;
    case "manager":
      return `${prefix} ${teamName} took ${player}`;
  }
};
