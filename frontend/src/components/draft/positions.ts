// Cell colours by position so the board reads at a glance.
export const POSITION_COLORS: Record<string, string> = {
  QB: "rgba(239,68,68,.22)",
  RB: "rgba(34,197,94,.22)",
  WR: "rgba(59,130,246,.22)",
  TE: "rgba(249,115,22,.22)",
  K: "rgba(168,85,247,.22)",
  DST: "rgba(148,163,184,.25)",
  DEF: "rgba(148,163,184,.25)",
};

export const positionColor = (position: string | null | undefined): string =>
  POSITION_COLORS[(position ?? "").toUpperCase()] ?? "transparent";
