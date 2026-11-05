// Cell colours by position so the board reads at a glance (the Claude Design draft board).
export const POSITION_COLORS: Record<string, string> = {
  QB: "#2a1f3d",
  RB: "#12302a",
  WR: "#1d2a45",
  TE: "#3a2a14",
  K: "#2b2b2b",
  DST: "#2a2f3a",
  DEF: "#2a2f3a",
};

export const positionColor = (position: string | null | undefined): string =>
  POSITION_COLORS[(position ?? "").toUpperCase()] ?? "transparent";
