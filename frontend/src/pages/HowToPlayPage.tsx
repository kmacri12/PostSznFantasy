import { Box, Button, Container, Paper, Typography } from "@mui/material";
import { useState } from "react";
import SettingsGroup from "../components/settings/SettingsGroup";
import TourDialog from "../components/tour/TourDialog";
import {
  HOW_TO_PLAY_GROUPS,
  HOW_TO_PLAY_LABEL,
  HOW_TO_PLAY_TOUR_PROMPT,
  TOUR_LABEL,
} from "../content/rules";

/** The tour link, then the rules as accordions grouped by when a player needs them; copy lives in content/rules.ts. */
const HowToPlayPage = () => {
  const [tourOpen, setTourOpen] = useState(false);
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {HOW_TO_PLAY_LABEL}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
        <Typography color="text.secondary">{HOW_TO_PLAY_TOUR_PROMPT}</Typography>
        <Button onClick={() => setTourOpen(true)} sx={{ minHeight: 44 }}>
          {TOUR_LABEL}
        </Button>
      </Box>
      {HOW_TO_PLAY_GROUPS.map((group) => (
        <Box component="section" key={group.id} sx={{ mb: 2.5 }}>
          <Typography
            variant="overline"
            component="h2"
            color="text.secondary"
            sx={{ display: "block", px: 0.5, mb: 0.5, lineHeight: 2 }}
          >
            {group.title}
          </Typography>
          <Paper
            sx={{ overflow: "hidden", "&& > * + *": { borderTop: 1, borderColor: "divider" } }}
          >
            {group.rules.map((rule) => (
              <SettingsGroup key={rule.id} title={rule.title}>
                <Typography sx={{ fontWeight: 700, mb: 1, maxWidth: "65ch" }}>
                  {rule.lead}
                </Typography>
                {rule.body.map((paragraph) => (
                  <Typography key={paragraph} sx={{ mb: 1, maxWidth: "65ch" }}>
                    {paragraph}
                  </Typography>
                ))}
              </SettingsGroup>
            ))}
          </Paper>
        </Box>
      ))}
      {tourOpen && <TourDialog onClose={() => setTourOpen(false)} />}
    </Container>
  );
};

export default HowToPlayPage;
