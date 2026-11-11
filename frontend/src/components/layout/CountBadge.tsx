import { Box, type SxProps, type Theme } from "@mui/material";
import { tokens } from "../../theme";

const MAX_SHOWN = 99;

/** The unread number on a tab: the digits plus a spoken label, never colour alone. */
export const CountBadge = ({ count, sx }: { count: number; sx?: SxProps<Theme> }) => (
  <Box
    component="span"
    role="img"
    aria-label={`${count} new`}
    sx={[
      {
        minWidth: 18,
        height: 18,
        px: "5px",
        borderRadius: "9px",
        bgcolor: tokens.red,
        color: tokens.accentInk,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: "18px",
        textAlign: "center",
        flex: "none",
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    <span aria-hidden="true">{count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}</span>
  </Box>
);
