import GavelIcon from "@mui/icons-material/Gavel";
import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import type { FeedEventItem } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { tint, tokens } from "../../theme";
import RecapRow from "../league/RecapRow";
import RoundRecapDialog from "../league/RoundRecapDialog";
import { COMMISSIONER_ACTION, eventLine, timeLabel } from "./feedView";

const pillSx = {
  alignSelf: "center",
  maxWidth: "92%",
  textAlign: "center",
  fontSize: 12,
  lineHeight: 1.4,
  color: tokens.muted,
  bgcolor: tokens.surface,
  border: `1px solid ${tokens.border}`,
  borderRadius: "12px",
  px: 1.5,
  py: "7px",
  overflowWrap: "anywhere",
} as const;

const Time = ({ iso }: { iso: string }) => (
  <Box component="time" dateTime={iso} sx={{ fontSize: 11, color: tokens.muted, ml: 0.75 }}>
    {timeLabel(iso)}
  </Box>
);

const Lead = ({ children }: { children: string }) => (
  <Box component="b" sx={{ color: tokens.textSoft, fontWeight: 600 }}>
    {children === COMMISSIONER_ACTION && (
      // Decorative: the words already say it.
      <GavelIcon
        aria-hidden
        sx={{ fontSize: "1em", verticalAlign: "-0.12em", mr: 0.5, color: tokens.warning }}
      />
    )}
    {children}
  </Box>
);

/** The weekly recap, read in place in the Feed; the button opens it on its own screen. */
const RecapCard = ({
  event,
  recap,
}: {
  event: FeedEventItem;
  recap: NonNullable<ReturnType<typeof eventLine>["recap"]>;
}) => {
  const { season } = useSeasonContext();
  const [open, setOpen] = useState(false);
  return (
    <Box
      component="li"
      sx={{
        ...pillSx,
        width: "92%",
        textAlign: "left",
        listStyle: "none",
        borderColor: tokens.accentBorder,
        bgcolor: tokens.accentSurface,
      }}
    >
      <Typography component="div" sx={{ textAlign: "center", fontSize: 12 }}>
        <Lead>Weekly recap</Lead>
        <Box component="b" sx={{ color: tokens.textSoft, fontWeight: 600 }}>
          {eventLine(event).text}
        </Box>
        <Time iso={event.createdAt} />
      </Typography>
      <Box
        component="ul"
        sx={{ m: 0, mt: 1, p: 0, display: "flex", flexDirection: "column", gap: 0.75 }}
      >
        {recap.highlights.map((highlight) => (
          <RecapRow key={highlight.kind} highlight={highlight} compact />
        ))}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Button size="small" onClick={() => setOpen(true)} sx={{ minHeight: 44, fontWeight: 600 }}>
          Open recap
        </Button>
      </Box>
      {open && (
        <RoundRecapDialog
          open
          onClose={() => setOpen(false)}
          leagueName={season.leagueName}
          year={season.year}
          round={recap.round}
          highlights={recap.highlights}
          teamScores={recap.teamScores}
        />
      )}
    </Box>
  );
};

/** One league event as a centered pill; a draft-order shuffle also lists the new order. */
const FeedEventRow = ({ event }: { event: FeedEventItem }) => {
  const line = eventLine(event);
  const warnSx = line.warn
    ? { color: tokens.warning, borderColor: tint(tokens.warning, 40) }
    : undefined;

  if (line.recap) return <RecapCard event={event} recap={line.recap} />;

  if (line.order) {
    return (
      <Box component="li" sx={{ ...pillSx, width: "92%", textAlign: "left", listStyle: "none" }}>
        <Typography component="div" sx={{ textAlign: "center", fontSize: 12 }}>
          {line.lead && <Lead>{line.lead}</Lead>}
          <Box component="b" sx={{ color: tokens.textSoft, fontWeight: 600 }}>
            {line.text}
          </Box>
          <Time iso={event.createdAt} />
        </Typography>
        <Box
          component="ol"
          aria-label="New draft order"
          sx={{
            m: 0,
            mt: 1,
            pl: 3,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "3px 12px",
            color: tokens.text,
            fontSize: 13,
          }}
        >
          {line.order.map((teamName) => (
            <li key={teamName}>{teamName}</li>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box component="li" sx={{ ...pillSx, ...warnSx, listStyle: "none" }}>
      {line.lead && <Lead>{line.lead}</Lead>}
      {line.text}
      <Time iso={event.createdAt} />
      {line.quote && (
        <Box
          sx={{
            mt: 0.75,
            fontSize: 13,
            color: tokens.text,
            textAlign: "left",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {line.quote}
        </Box>
      )}
      {line.details.map((detail) => (
        <Box key={detail} sx={{ fontSize: 11, color: tokens.muted }}>
          {detail}
        </Box>
      ))}
    </Box>
  );
};

export default FeedEventRow;
