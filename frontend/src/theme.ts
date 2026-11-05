import { createTheme } from "@mui/material/styles";
import { E2E_BUILD } from "./utils/e2e";

export type ThemeMode = "dark" | "light";

interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  /** Secondary body text, between `text` and `muted`. */
  textSoft: string;
  muted: string;
  /** The WCAG 1.4.11 minimum (3:1) for form control boundaries. */
  inputBorder: string;
  /** Accent as text, links, icons, borders and the focus ring. */
  accent: string;
  /** Accent as a fill (buttons, active mark); always carries `accentInk` text. */
  accentFill: string;
  /** Text and icons on an accent fill. */
  accentInk: string;
  accentSurface: string;
  accentBorder: string;
  accentSoft: string;
  /** Drag handles and other quiet strokes. */
  handle: string;
  /** Medal colour for first place. */
  gold: string;
  /** Cautions such as injury tags, and live-game tags. */
  warning: string;
  green: string;
  /** Live games and live scores: green is a status color, not the brand accent (#297). */
  live: string;
  /** Secondary text beside a live indicator. */
  liveSoft: string;
  /** Errors and the new-activity dot. */
  red: string;
  /** Destructive rows such as Sign out. */
  redSoft: string;
  /** The Eliminated group: card border, header, row fill and secondary text. */
  dangerBorder: string;
  dangerHeader: string;
  dangerSurface: string;
  dangerMuted: string;
  cyan: string;
  /** Draft board cell fills by position. */
  posQB: string;
  posRB: string;
  posWR: string;
  posTE: string;
  posK: string;
  posDST: string;
}

/** The Claude Design mockup palette (#258, #297, #298): sky blue on graphite, or on white. */
export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    bg: "#121416",
    surface: "#1b1e21",
    surfaceRaised: "#202427",
    border: "#2a2e33",
    borderStrong: "#353a40",
    text: "#eceff1",
    textSoft: "#aab2b9",
    muted: "#8d969e",
    inputBorder: "#69737b",
    accent: "#5cb8ff",
    accentFill: "#5cb8ff",
    accentInk: "#04233d",
    accentSurface: "#12293d",
    accentBorder: "#1f4f78",
    accentSoft: "#a9d4f5",
    handle: "#3a4046",
    gold: "#fbbf24",
    warning: "#d9c36a",
    green: "#22c55e",
    live: "#34d399",
    liveSoft: "#a8d9c8",
    red: "#f0626b",
    redSoft: "#f0a0a5",
    dangerBorder: "#5a2a2f",
    dangerHeader: "#3a1a1e",
    dangerSurface: "#2a1417",
    dangerMuted: "#d98a90",
    cyan: "#22d3ee",
    posQB: "#2a1f3d",
    posRB: "#143024",
    posWR: "#1d2a45",
    posTE: "#3a2a14",
    posK: "#2b2b2b",
    posDST: "#2a2f3a",
  },
  light: {
    bg: "#ffffff",
    surface: "#f4f6f8",
    surfaceRaised: "#eaeef2",
    border: "#dfe3e8",
    borderStrong: "#c8cfd6",
    text: "#14181c",
    textSoft: "#3d474f",
    muted: "#5b6670",
    inputBorder: "#727d87",
    accent: "#0868b4",
    accentFill: "#5cb8ff",
    accentInk: "#04233d",
    accentSurface: "#e3f2ff",
    accentBorder: "#a8d3f5",
    accentSoft: "#07578f",
    handle: "#c8cfd6",
    gold: "#8a6100",
    warning: "#8a6100",
    green: "#15803d",
    live: "#0b7a4b",
    liveSoft: "#0a6a41",
    red: "#c62f3b",
    redSoft: "#b4232f",
    dangerBorder: "#e8b4b8",
    dangerHeader: "#f9dcdf",
    dangerSurface: "#fdf0f1",
    dangerMuted: "#a8323c",
    cyan: "#0e7490",
    posQB: "#ece5f7",
    posRB: "#dff3e6",
    posWR: "#dde8fa",
    posTE: "#f8eadb",
    posK: "#e9eaec",
    posDST: "#e4e8ee",
  },
};

const cssVariable = (key: string): string => `--ps-${key}`;

/**
 * What components put in `sx`: a CSS variable per token, so the mode flips without re-rendering
 * them. The values come from `modeVariables` (rendered once by ThemeModeProvider).
 */
export const tokens = Object.fromEntries(
  Object.keys(palettes.dark).map((key) => [key, `var(${cssVariable(key)})`]),
) as Record<keyof Palette, string>;

const variableBlock = (palette: Palette): string =>
  Object.entries(palette)
    .map(([key, value]) => `${cssVariable(key)}: ${value};`)
    .join(" ");

/** Dark is the default; `data-theme="light"` on <html> switches every token. */
export const modeVariables = `:root { color-scheme: dark; ${variableBlock(palettes.dark)} }
:root[data-theme="light"] { color-scheme: light; ${variableBlock(palettes.light)} }`;

/** A token at a given opacity, for fills that need a see-through accent or status color. */
export const tint = (color: string, percent: number): string =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

export const radii = { mark: 8, button: 12, card: 14 };

/** Bottom tab bar height in px, without the iPhone safe-area inset. */
export const TAB_BAR_HEIGHT = 64;
/** Width of the desktop navigation rail in px. */
export const RAIL_WIDTH = 232;
/** Header height in px. */
export const HEADER_HEIGHT = 56;

/** Minimum touch target in px (WCAG 2.5.5 / mobile-first rule in AGENTS.md). */
const TOUCH_TARGET = 44;

export const glassCard = {
  backgroundColor: tint(tokens.surface, 70),
  backdropFilter: "blur(12px)",
  border: `1px solid ${tokens.border}`,
  borderRadius: `${radii.card}px`,
};

// Playwright cannot tell a mid-animation element from a settled one, so the e2e build makes every
// transition instant: dialogs, drawers and accordions are final as soon as React renders them.
const instantMotion = E2E_BUILD;

/** MUI computes hover and disabled shades from real colors, so the palette takes the raw hex. */
export const createAppTheme = (mode: ThemeMode) => {
  const raw = palettes[mode];
  return createTheme({
    ...(instantMotion && {
      transitions: {
        duration: {
          shortest: 0,
          shorter: 0,
          short: 0,
          standard: 0,
          complex: 0,
          enteringScreen: 0,
          leavingScreen: 0,
        },
        create: () => "none",
        getAutoHeightDuration: () => 0,
      },
    }),
    palette: {
      mode,
      primary: { main: raw.accent, contrastText: mode === "dark" ? raw.accentInk : "#ffffff" },
      secondary: { main: raw.cyan },
      success: { main: raw.green },
      warning: { main: raw.warning },
      error: { main: raw.red },
      background: { default: raw.bg, paper: raw.surface },
      text: { primary: raw.text, secondary: raw.muted },
      divider: raw.border,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h1: { fontWeight: 800, letterSpacing: "-0.03em" },
      h2: { fontWeight: 800, letterSpacing: "-0.02em" },
      h3: { fontWeight: 700, letterSpacing: "-0.02em" },
      h4: { fontWeight: 700, letterSpacing: "-0.01em" },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      ...(instantMotion && {
        MuiCssBaseline: {
          styleOverrides:
            "*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }",
        },
      }),
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: "none", border: `1px solid ${tokens.border}` },
        },
      },
      MuiCard: {
        styleOverrides: { root: { ...glassCard } },
      },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            "&.Mui-focusVisible": { outline: `2px solid ${tokens.accent}`, outlineOffset: 2 },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: TOUCH_TARGET,
            borderRadius: radii.button,
            // Sky blue stays the button fill in both modes; on white only the darker accent is legible as text.
            "&.MuiButton-contained.MuiButton-colorPrimary:not(.Mui-disabled)": {
              backgroundColor: tokens.accentFill,
              color: tokens.accentInk,
              "&:hover": { backgroundColor: `color-mix(in srgb, ${tokens.accentFill} 88%, #000)` },
            },
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          // The default grey fill with white text is 1.9:1 on white.
          root: {
            "&.MuiAvatar-colorDefault": {
              backgroundColor: tokens.borderStrong,
              color: tokens.text,
            },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            "&.Mui-selected, &.Mui-selected:hover": {
              backgroundColor: tokens.accentSurface,
              color: tokens.accent,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
          clickable: { minHeight: TOUCH_TARGET },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${tokens.border}` },
          head: {
            color: tokens.muted,
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: TOUCH_TARGET,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.inputBorder },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { ...glassCard, backgroundColor: tint(tokens.surface, 95) },
        },
      },
      MuiDrawer: {
        styleOverrides: { paper: { backgroundColor: tokens.bg, backgroundImage: "none" } },
      },
    },
  });
};

const theme = createAppTheme("dark");
export default theme;
