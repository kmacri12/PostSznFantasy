import { Box, Typography } from "@mui/material";
import { useLeagueSettings } from "../../api/queries";
import type { DraftPick } from "../../api/types";
import { radii, tokens } from "../../theme";
import LoadingState from "../common/LoadingState";
import { draftRoster, type RosterSlot } from "./rosterSlots";

const Slot = ({ slot, starter }: { slot: RosterSlot; starter: boolean }) => (
  <Box
    component="li"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.25,
      minHeight: 40,
      px: 1.25,
      border: `1px solid ${tokens.border}`,
      borderRadius: "8px",
      fontSize: 13,
      listStyle: "none",
    }}
  >
    <Box
      component="b"
      sx={{
        width: 52,
        flexShrink: 0,
        fontSize: 11,
        letterSpacing: 1,
        color: starter ? tokens.accent : tokens.muted,
      }}
    >
      {slot.label}
    </Box>
    {slot.pick ? (
      <span>
        {slot.pick.playerName}{" "}
        <Box component="small" sx={{ color: tokens.muted }}>
          {slot.pick.position} {slot.pick.teamAbv}
        </Box>
      </span>
    ) : (
      <Box component="span" sx={{ color: tokens.muted }}>
        Empty
      </Box>
    )}
  </Box>
);

/** My roster slot by slot as the draft fills it: starters, then the bench. */
const RosterView = ({ seasonId, picks }: { seasonId: number; picks: DraftPick[] }) => {
  const settings = useLeagueSettings(seasonId).data;
  if (!settings) return <LoadingState what="your roster" />;
  const roster = draftRoster(settings, picks);
  return (
    <Box
      component="section"
      aria-label="Your roster"
      sx={{
        p: 1.75,
        bgcolor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${radii.card}px`,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Your roster</Typography>
        <Typography sx={{ fontSize: 12, color: tokens.muted }}>
          {roster.filledStarters} of {roster.starters.length} starters
        </Typography>
      </Box>
      <Box component="ul" sx={{ m: 0, p: 0, display: "grid", gap: 0.75 }}>
        {roster.starters.map((slot, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
          <Slot key={index} slot={slot} starter />
        ))}
      </Box>
      {roster.bench.length > 0 && (
        <>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: tokens.muted,
              pt: 1,
              px: 0.25,
            }}
          >
            Bench
          </Typography>
          <Box component="ul" sx={{ m: 0, p: 0, display: "grid", gap: 0.75 }}>
            {roster.bench.map((slot, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
              <Slot key={index} slot={slot} starter={false} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

export default RosterView;
