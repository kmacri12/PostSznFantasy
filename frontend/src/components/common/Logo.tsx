import { Box } from "@mui/material";
import tileUrl from "../../assets/logo-tile.svg";
import { LOGO_STROKES } from "../../assets/logoGeometry";
import { tokens } from "../../theme";

const WORDMARK_FONT = '"Space Grotesk", Inter, system-ui, sans-serif';

interface Props {
  variant?: "mark" | "lockup" | "stacked";
  /** Height of the mark in px; the wordmark scales with it. */
  size?: number;
  /** The sky-blue tile instead of bare lines; use it under 40px, where bare lines go faint. */
  tile?: boolean;
}

const Mark = ({ size, tile }: { size: number; tile: boolean }) =>
  tile ? (
    <Box
      component="img"
      src={tileUrl}
      alt=""
      aria-hidden
      sx={{ width: size, height: size, flex: "none", display: "block" }}
    />
  ) : (
    <Box
      component="svg"
      viewBox="0 0 100 100"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      sx={{ width: size, height: size, flex: "none", display: "block", color: tokens.accent }}
    >
      {LOGO_STROKES.map(({ d, width, cap }) => (
        <path key={d} d={d} strokeWidth={width} strokeLinecap={cap} />
      ))}
    </Box>
  );

const Wordmark = ({ fontSize, center }: { fontSize: number; center: boolean }) => (
  <Box
    sx={{
      fontFamily: WORDMARK_FONT,
      lineHeight: 1,
      textAlign: center ? "center" : "left",
      color: tokens.text,
      whiteSpace: "nowrap",
    }}
  >
    <Box
      component="span"
      sx={{ display: "block", fontSize, fontWeight: 700, letterSpacing: "-0.04em" }}
    >
      Post
      <Box component="span" sx={{ color: tokens.accent }}>
        Szn
      </Box>
    </Box>
    <Box
      component="span"
      sx={{
        display: "block",
        mt: `${Math.round(fontSize * 0.18)}px`,
        fontSize: Math.max(8, Math.round(fontSize * 0.3)),
        fontWeight: 500,
        letterSpacing: "0.28em",
        // The trailing tracking would otherwise push a centered line off-center.
        mr: center ? "-0.28em" : 0,
      }}
    >
      FANTASY
    </Box>
  </Box>
);

/** The bracket mark, the horizontal lockup or the stacked lockup (docs/ui/README.md, Logo). */
const Logo = ({ variant = "mark", size, tile = false }: Props) => {
  const label = "PostSzn Fantasy";
  if (variant === "mark") {
    return (
      <Box role="img" aria-label={label} sx={{ display: "flex" }}>
        <Mark size={size ?? 32} tile={tile} />
      </Box>
    );
  }
  if (variant === "lockup") {
    const markSize = size ?? 40;
    return (
      <Box
        role="img"
        aria-label={label}
        sx={{ display: "flex", alignItems: "center", gap: `${Math.round(markSize * 0.25)}px` }}
      >
        <Mark size={markSize} tile={tile} />
        <Wordmark fontSize={Math.round(markSize * 0.7)} center={false} />
      </Box>
    );
  }
  const markSize = size ?? 96;
  return (
    <Box
      role="img"
      aria-label={label}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${Math.round(markSize * 0.14)}px`,
      }}
    >
      <Mark size={markSize} tile={tile} />
      <Wordmark fontSize={Math.round(markSize * 0.5)} center />
    </Box>
  );
};

export default Logo;
