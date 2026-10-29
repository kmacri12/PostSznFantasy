import { alpha, createTheme } from "@mui/material/styles";

export const tokens = {
  bg: "#0f172a",
  surface: "#111c33",
  border: "#1e293b",
  borderStrong: "#334155",
  text: "#e2e8f0",
  muted: "#94a3b8",
  gold: "#fbbf24",
  green: "#22c55e",
  red: "#ef4444",
  cyan: "#22d3ee",
};

export const glassCard = {
  backgroundColor: alpha(tokens.surface, 0.7),
  backdropFilter: "blur(12px)",
  border: `1px solid ${tokens.border}`,
  borderRadius: 2,
};

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: tokens.gold, contrastText: "#1c1203" },
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
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none", border: `1px solid ${tokens.border}` },
      },
    },
    MuiCard: {
      styleOverrides: { root: { ...glassCard } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, transition: "transform .15s, box-shadow .15s" },
        containedPrimary: {
          background: `linear-gradient(135deg, ${tokens.gold}, #f97316)`,
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: `0 6px 20px ${alpha(tokens.gold, 0.35)}`,
          },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
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
          "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.borderStrong },
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
