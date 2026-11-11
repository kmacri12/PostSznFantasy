import { Box } from "@mui/material";
import { tokens } from "../../theme";

export type IllustrationName = "leagues" | "messages" | "lineup";

const SIZE = 72;

/** Small line drawings for empty states; decorative, so hidden from assistive technology. */
const shapes: Record<IllustrationName, React.ReactNode> = {
  // A football on its tee.
  leagues: (
    <>
      <ellipse cx="36" cy="34" rx="24" ry="14" transform="rotate(-20 36 34)" />
      <path d="M28 40l16-12M33 34l-3 4M38 30l-3 4M43 26l-3 4" />
      <path d="M26 62h20" />
    </>
  ),
  // A speech bubble.
  messages: (
    <>
      <path d="M14 18h44a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H34l-12 10V48h-8a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z" />
      <path d="M24 30h24M24 38h14" />
    </>
  ),
  // Empty starter slots.
  lineup: (
    <>
      <rect x="12" y="14" width="48" height="12" rx="4" strokeDasharray="4 4" />
      <rect x="12" y="32" width="48" height="12" rx="4" strokeDasharray="4 4" />
      <rect x="12" y="50" width="48" height="12" rx="4" strokeDasharray="4 4" />
    </>
  ),
};

const Illustration = ({ name }: { name: IllustrationName }) => (
  <Box
    component="svg"
    aria-hidden
    focusable="false"
    viewBox="0 0 72 72"
    width={SIZE}
    height={SIZE}
    data-illustration={name}
    sx={{
      display: "block",
      mx: "auto",
      mb: 1.5,
      color: tokens.accent,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }}
  >
    {shapes[name]}
  </Box>
);

export default Illustration;
