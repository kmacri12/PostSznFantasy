import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

/** A settings row that opens in place, so the page stays short on a phone; sits inside a SettingsCard. */
const SettingsGroup = ({
  title,
  summary,
  id,
  defaultExpanded = false,
  children,
}: {
  title: string;
  /** One muted line under the title while collapsed. */
  summary?: string;
  /** Lets a link such as `#locks` find the row. */
  id?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) => (
  <Accordion
    id={id}
    defaultExpanded={defaultExpanded}
    disableGutters
    square
    sx={{ border: 0, "&::before": { display: "none" } }}
  >
    <AccordionSummary
      expandIcon={<ExpandMoreIcon />}
      sx={{ minHeight: 52, px: 2, "& .MuiAccordionSummary-content": { minWidth: 0 } }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
        {summary && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {summary}
          </Typography>
        )}
      </Box>
    </AccordionSummary>
    <AccordionDetails sx={{ px: 1.5 }}>{children}</AccordionDetails>
  </Accordion>
);

export default SettingsGroup;
