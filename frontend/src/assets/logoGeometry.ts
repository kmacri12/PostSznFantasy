/** The bracket mark's strokes on a 100x100 canvas; `logo-tile.svg` draws the same paths on the tile (logoGeometry.test.ts checks). */
export const LOGO_STROKES = [
  {
    d: "M10 16H23Q27 16 27 20V32Q27 36 23 36H10M10 64H23Q27 64 27 68V80Q27 84 23 84H10",
    width: 3,
    cap: "round",
  },
  { d: "M27 26H36Q40 26 40 30V70Q40 74 36 74H27", width: 5, cap: "butt" },
  {
    d: "M90 16H77Q73 16 73 20V32Q73 36 77 36H90M90 64H77Q73 64 73 68V80Q73 84 77 84H90",
    width: 3,
    cap: "round",
  },
  { d: "M73 26H64Q60 26 60 30V70Q60 74 64 74H73", width: 5, cap: "butt" },
  { d: "M40 50H60", width: 8, cap: "butt" },
] as const;
