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

/** The position tag shared by the player list and the Team page: the board's colour behind readable text. */
export const positionChipSx = (position: string | null | undefined) => ({
  bgcolor: positionColor(position),
  color: tokens.text,
  borderRadius: 1,
  px: 0.75,
  fontWeight: 600,
});

const ROW_COLORS: Record<string, string> = {
  QB: tokens.rowQB,
  RB: tokens.rowRB,
  WR: tokens.rowWR,
  TE: tokens.rowTE,
  K: tokens.rowK,
  DST: tokens.rowDST,
  DEF: tokens.rowDST,
};

const EDGE_COLORS: Record<string, string> = {
  QB: tokens.edgeQB,
  RB: tokens.edgeRB,
  WR: tokens.edgeWR,
  TE: tokens.edgeTE,
  K: tokens.edgeK,
  DST: tokens.edgeDST,
  DEF: tokens.edgeDST,
};

/** A Team page lineup row's light position wash; `positionEdgeColor` is its solid left edge (#527). */
export const positionRowColor = (position: string | null | undefined): string =>
  ROW_COLORS[(position ?? "").toUpperCase()] ?? "transparent";

export const positionEdgeColor = (position: string | null | undefined): string =>
  EDGE_COLORS[(position ?? "").toUpperCase()] ?? "transparent";
