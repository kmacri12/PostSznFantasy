import { Box, Typography } from "@mui/material";
import type { FeedEventItem } from "../../api/types";
import { tint, tokens } from "../../theme";
import { eventLine, timeLabel } from "./feedView";

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
    {children}
  </Box>
);

/** One league event as a centered pill; a draft-order shuffle also lists the new order. */
const FeedEventRow = ({ event }: { event: FeedEventItem }) => {
  const line = eventLine(event);
  const warnSx = line.warn
    ? { color: tokens.warning, borderColor: tint(tokens.warning, 40) }
    : undefined;

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
      {line.details.map((detail) => (
        <Box key={detail} sx={{ fontSize: 11, color: tokens.muted }}>
          {detail}
        </Box>
      ))}
    </Box>
  );
};

export default FeedEventRow;
