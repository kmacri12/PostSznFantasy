import { Box, Chip, Tooltip } from "@mui/material";

/** "Scores all PHI QBs" for a team QB or K, shown wherever his name appears. */
export const teamUnitHint = (position: string, teamAbv?: string | null): string =>
  `Scores all ${teamAbv || "team"} ${position === "K" ? "Ks" : "QBs"}`;

interface Props {
  position: string;
  teamAbv?: string | null;
  /** Skip the 44px touch target where space is tight (the draft board grid). */
  dense?: boolean;
}

/** Opens on hover, focus or a tap, so it works on touch as well as with a mouse. */
const TeamUnitBadge = ({ position, teamAbv, dense = false }: Props) => {
  const hint = teamUnitHint(position, teamAbv);
  return (
    <Tooltip title={hint} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
      <Box
        component="span"
        tabIndex={0}
        role="note"
        aria-label={`Team ${position}. ${hint}`}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          cursor: "help",
          minHeight: dense ? undefined : 44,
          minWidth: dense ? undefined : 44,
        }}
      >
        <Chip
          size="small"
          variant="outlined"
          label={`Team ${position}`}
          sx={{ height: 20, fontSize: 11, pointerEvents: "none" }}
        />
      </Box>
    </Tooltip>
  );
};

export default TeamUnitBadge;
