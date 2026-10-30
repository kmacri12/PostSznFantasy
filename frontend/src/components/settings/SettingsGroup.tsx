import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";
import type { ReactNode } from "react";

/** A top-level settings block that collapses so the page stays short on a phone. */
const SettingsGroup = ({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) => (
  <Accordion defaultExpanded={defaultExpanded} disableGutters sx={{ mb: 1.5 }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
    </AccordionSummary>
    <AccordionDetails>{children}</AccordionDetails>
  </Accordion>
);

export default SettingsGroup;
