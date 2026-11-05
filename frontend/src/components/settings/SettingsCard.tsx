import { Box, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  title?: string;
  /** Red border for the delete card. */
  danger?: boolean;
  children: ReactNode;
}

/** A labelled card whose rows are separated by dividers. */
const SettingsCard = ({ title, danger = false, children }: Props) => (
  <Box component="section" sx={{ mb: 2.5 }}>
    {title && (
      <Typography
        variant="overline"
        component="h2"
        color="text.secondary"
        sx={{ display: "block", px: 0.5, mb: 0.5, lineHeight: 2 }}
      >
        {title}
      </Typography>
    )}
    <Paper
      sx={{
        overflow: "hidden",
        borderColor: danger ? "error.dark" : undefined,
        "&& > * + *": { borderTop: 1, borderColor: "divider" },
      }}
    >
      {children}
    </Paper>
  </Box>
);

export default SettingsCard;
