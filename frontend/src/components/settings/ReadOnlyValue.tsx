import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import HelpTip from "../common/HelpTip";

interface ReadOnlyValueProps {
  label: string;
  value: ReactNode;
  help?: string;
}

/** A setting the viewer can't change: plain text, so it never takes focus or shows a cursor. */
const ReadOnlyValue = ({ label, value, help }: ReadOnlyValueProps) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 44 }}>
    <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    {help && <HelpTip label={label} text={help} />}
  </Box>
);

export default ReadOnlyValue;
