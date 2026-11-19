import { tokens } from "../../theme";

// Cell colours by position so the board reads at a glance (the Claude Design draft board).
export const POSITION_COLORS: Record<string, string> = {
  QB: tokens.posQB,
  RB: tokens.posRB,
  WR: tokens.posWR,
  TE: tokens.posTE,
  K: tokens.posK,
  DST: tokens.posDST,
  DEF: tokens.posDST,
};

export const positionColor = (position: string | null | undefined): string =>
  POSITION_COLORS[(position ?? "").toUpperCase()] ?? "transparent";

const TAG_COLORS: Record<string, string> = {
  QB: tokens.tagQB,
  RB: tokens.tagRB,
  WR: tokens.tagWR,
  TE: tokens.tagTE,
  K: tokens.tagK,
  DST: tokens.tagDST,
  DEF: tokens.tagDST,
};

/** The position tag shared by the player list and the Team page: saturated, since a small tag in the board's muted fills vanished (#527). */
export const positionChipSx = (position: string | null | undefined) => ({
  bgcolor: TAG_COLORS[(position ?? "").toUpperCase()] ?? "transparent",
  color: tokens.tagInk,
  borderRadius: 1,
  px: 0.75,
  fontWeight: 600,
});
