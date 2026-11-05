import { Box, type SxProps, type Theme } from "@mui/material";
import { tokens } from "../../theme";

/** The new-activity dot: a shape plus a spoken label, so it never relies on colour. */
export const NewActivityDot = ({ label, sx }: { label: string; sx?: SxProps<Theme> }) => (
  <Box
    component="span"
    role="img"
    aria-label={label}
    sx={[
      { width: 8, height: 8, borderRadius: "50%", bgcolor: tokens.red, flex: "none" },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  />
);
