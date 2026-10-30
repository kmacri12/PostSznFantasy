import { Box, Chip, Paper, Typography } from "@mui/material";
import { useLeagueSettings } from "../../api/queries";
import {
  PRE_DRAFT_INTRO,
  PRE_DRAFT_RULES,
  PRE_DRAFT_TITLE,
  PRE_DRAFT_UNLIMITED,
  TEAM_K_ON_NOTE,
  TEAM_QB_ON_NOTE,
} from "../../content/rules";
import { tokens } from "../../theme";
import { positionCaps, startingSlots } from "./preDraft";

const Row = ({ label, detail }: { label: string; detail: string }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minHeight: 44 }}>
    <Chip size="small" label={label} sx={{ width: 64, color: tokens.gold }} />
    <Typography>{detail}</Typography>
  </Box>
);

const Heading = ({ children }: { children: string }) => (
  <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 1 }}>
    {children}
  </Typography>
);

/** The empty roster before the draft: every slot, the caps and the lock rules, to plan picks. */
const PreDraftRoster = ({ leagueId }: { leagueId: number }) => {
  const { data: settings } = useLeagueSettings(leagueId);
  if (!settings) return null;
  const { starters, bench } = startingSlots(settings);
  const caps = positionCaps(settings);
  const unitNotes = [
    settings.teamQb === true ? TEAM_QB_ON_NOTE : null,
    settings.teamK === true ? TEAM_K_ON_NOTE : null,
  ].filter((note): note is string => note !== null);

  return (
    <Paper component="section" aria-label={PRE_DRAFT_TITLE} sx={{ p: 2, mb: 2, maxWidth: 760 }}>
      <Typography variant="h6" component="h2">
        {PRE_DRAFT_TITLE}
      </Typography>
      <Typography color="text.secondary">{PRE_DRAFT_INTRO}</Typography>

      <Heading>Starter slots</Heading>
      {starters.map((slot) => (
        <Row key={slot.label} label={slot.label} detail={`${slot.count} per round`} />
      ))}
      <Heading>Bench</Heading>
      <Row label="BN" detail={`${bench} spots. Bench players do not score.`} />

      <Heading>Most you can draft per position</Heading>
      {caps.map((cap) => (
        <Row
          key={cap.position}
          label={cap.position}
          detail={cap.max === null ? PRE_DRAFT_UNLIMITED : `At most ${cap.max}`}
        />
      ))}

      {unitNotes.length > 0 && (
        <>
          <Heading>Team positions</Heading>
          {unitNotes.map((note) => (
            <Typography key={note} sx={{ mb: 0.5 }}>
              {note}
            </Typography>
          ))}
        </>
      )}

      <Heading>The rules</Heading>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {PRE_DRAFT_RULES.map((rule) => (
          <Typography component="li" key={rule} sx={{ mb: 0.5 }}>
            {rule}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
};

export default PreDraftRoster;
