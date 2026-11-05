import { alpha, createTheme } from "@mui/material/styles";
import { E2E_BUILD } from "./utils/e2e";

/** The Claude Design mockup palette (#258): dark surfaces with one green accent. */
export const tokens = {
  bg: "#0f1218",
  surface: "#171b23",
  surfaceRaised: "#1c212b",
  border: "#232834",
  borderStrong: "#2f3643",
  text: "#e8eaf0",
  /** Secondary body text, between `text` and `muted`. */
  textSoft: "#a7afbd",
  muted: "#8b94a5",
  /** 3.7:1 on bg, the WCAG 1.4.11 minimum for form control boundaries. */
  inputBorder: "#667085",
  accent: "#34d399",
  /** Text and icons on an accent fill. */
  accentInk: "#06281c",
  accentSurface: "#12302a",
  accentBorder: "#1f5a49",
  accentSoft: "#a8d9c8",
  /** Medal colour for first place. */
  gold: "#fbbf24",
  /** Cautions such as injury tags, and live-game tags. */
  warning: "#d9c36a",
  green: "#22c55e",
  /** Errors and the new-activity dot. */
  red: "#f0626b",
  /** Destructive rows such as Sign out. */
  redSoft: "#f0a0a5",
  /** The Eliminated group: card border, header, row fill and secondary text. */
  dangerBorder: "#5a2a2f",
  dangerHeader: "#3a1a1e",
  dangerSurface: "#2a1417",
  dangerMuted: "#d98a90",
  cyan: "#22d3ee",
};

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
  backgroundColor: alpha(tokens.surface, 0.7),
  backdropFilter: "blur(12px)",
  border: `1px solid ${tokens.border}`,
  borderRadius: `${radii.card}px`,
};

// Playwright cannot tell a mid-animation element from a settled one, so the e2e build makes every
// transition instant: dialogs, drawers and accordions are final as soon as React renders them.
const instantMotion = E2E_BUILD;

const theme = createTheme({
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
    mode: "dark",
    primary: { main: tokens.accent, contrastText: tokens.accentInk },
    secondary: { main: tokens.cyan },
    success: { main: tokens.green },
    error: { main: tokens.red },
    background: { default: tokens.bg, paper: tokens.surface },
    text: { primary: tokens.text, secondary: tokens.muted },
    divider: tokens.border,
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
        paper: { ...glassCard, backgroundColor: alpha(tokens.surface, 0.95) },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: tokens.bg, backgroundImage: "none" } },
    },
  },
});

export default theme;
