import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SensorsIcon from "@mui/icons-material/Sensors";
import { Box, Tooltip } from "@mui/material";
import type { StarterProgress } from "../../api/types";
import { tokens } from "../../theme";
import { PROGRESS_ITEMS, type ProgressKey } from "./standingsView";

const ICONS = {
  finished: CheckCircleOutlinedIcon,
  live: SensorsIcon,
  toPlay: ScheduleIcon,
  notPlaying: BlockIcon,
} satisfies Record<ProgressKey, typeof BlockIcon>;

const COLORS: Record<ProgressKey, string> = {
  finished: tokens.green,
  live: tokens.red,
  toPlay: tokens.cyan,
  notPlaying: tokens.muted,
};

const ProgressItem = ({
  itemKey,
  label,
  hint,
  count,
  compact,
}: {
  itemKey: ProgressKey;
  label: string;
  hint: string;
  count: number;
  compact: boolean;
}) => {
  const Icon = ICONS[itemKey];
  const item = (
    <Box
      component="li"
      aria-label={`${label}: ${count}`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: compact ? 28 : 36,
        px: compact ? 0.75 : 1,
        border: `1px solid ${COLORS[itemKey]}`,
        borderRadius: 1,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
        opacity: count === 0 ? 0.6 : 1,
        "@media (prefers-reduced-motion: no-preference)": {
          "& .live-pulse": { animation: "pulse 1.6s ease-in-out infinite" },
        },
        "@keyframes pulse": { "50%": { opacity: 0.35 } },
      }}
    >
      <Icon
        className={itemKey === "live" && count > 0 ? "live-pulse" : undefined}
        sx={{ color: COLORS[itemKey], fontSize: 18 }}
        aria-hidden
      />
      <span aria-hidden>{compact ? count : `${label} ${count}`}</span>
    </Box>
  );
  return compact ? <Tooltip title={`${label}: ${hint}`}>{item}</Tooltip> : item;
};

interface ProgressCountsProps {
  progress: StarterProgress;
  /** Icon and number only, for table cells; the full word stays in the accessible name. */
  compact?: boolean;
}

/** Starter slots by game state. Colour is a hint only: every count has an icon and a word. */
const ProgressCounts = ({ progress, compact = false }: ProgressCountsProps) => (
  <Box
    component="ul"
    aria-label="Starters this round"
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "grid",
      gridTemplateColumns: compact ? "repeat(4, auto)" : { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
      justifyContent: compact ? "start" : undefined,
      gap: compact ? 1 : 0.75,
    }}
  >
    {PROGRESS_ITEMS.map(({ key, label, hint }) => (
      <ProgressItem
        key={key}
        itemKey={key}
        label={label}
        hint={hint}
        count={progress[key]}
        compact={compact}
      />
    ))}
  </Box>
);

export default ProgressCounts;
