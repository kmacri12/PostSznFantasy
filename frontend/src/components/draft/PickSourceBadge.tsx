import type { SvgIconComponent } from "@mui/icons-material";
import BoltIcon from "@mui/icons-material/Bolt";
import GavelIcon from "@mui/icons-material/Gavel";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import TimerOffOutlinedIcon from "@mui/icons-material/TimerOffOutlined";
import { Box, Typography } from "@mui/material";
import type { DraftPick, PickSource } from "../../api/types";
import { tokens } from "../../theme";
import { SOURCE_LEGEND, sourcesOnBoard } from "./pickSource";

const ICONS: Record<Exclude<PickSource, "manager">, SvgIconComponent> = {
  timer: TimerOffOutlinedIcon,
  autopilot: SmartToyOutlinedIcon,
  no_owner: PersonOffOutlinedIcon,
  commissioner_auto: BoltIcon,
  commissioner_assigned: GavelIcon,
};

const isCommissioner = (source: PickSource) => source.startsWith("commissioner");

/** The board cell's corner mark; decorative, the cell's hidden text says it in words. */
export const PickSourceIcon = ({ source, size = 11 }: { source: PickSource; size?: number }) => {
  if (source === "manager") return null;
  const Icon = ICONS[source];
  return (
    <Icon
      aria-hidden
      data-testid={`source-${source}`}
      sx={{
        fontSize: size,
        verticalAlign: "-0.15em",
        color: isCommissioner(source) ? tokens.warning : tokens.muted,
      }}
    />
  );
};

/** One line under the board naming each badge on it; nothing while every pick is the manager's. */
export const PickSourceLegend = ({ picks }: { picks: DraftPick[] }) => {
  const sources = sourcesOnBoard(picks);
  if (sources.length === 0) return null;
  return (
    <Box
      component="ul"
      aria-label="Pick marks"
      sx={{
        listStyle: "none",
        m: 0,
        px: 2,
        py: 1,
        display: "flex",
        flexWrap: "wrap",
        columnGap: 1.5,
        rowGap: 0.5,
      }}
    >
      {sources.map((source) => (
        <Box component="li" key={source} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <PickSourceIcon source={source} size={14} />
          <Typography component="span" sx={{ fontSize: 12, color: tokens.textSoft }}>
            {SOURCE_LEGEND[source]}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
