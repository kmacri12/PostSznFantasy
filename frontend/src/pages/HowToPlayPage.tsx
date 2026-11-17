import { Box, Button, Container, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import SettingsGroup from "../components/settings/SettingsGroup";
import TourDialog from "../components/tour/TourDialog";
import {
  HOW_TO_PLAY_GROUPS,
  HOW_TO_PLAY_LABEL,
  HOW_TO_PLAY_TOUR_PROMPT,
  TOUR_LABEL,
  TOUR_TITLE,
} from "../content/rules";
import { tokens } from "../theme";

/** The tour card, then the rules in full as accordions grouped by when a player needs them; copy lives in content/rules.ts. */
const HowToPlayPage = () => {
  const [tourOpen, setTourOpen] = useState(false);
  const target = useLocation().hash.slice(1);
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [target]);
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {HOW_TO_PLAY_LABEL}
      </Typography>
      <Box
        component="section"
        aria-labelledby="tour-card-title"
        sx={{
          p: 2,
          mb: 3,
          borderRadius: "20px",
          bgcolor: tokens.accentSurface,
          border: `1px solid ${tokens.accentBorder}`,
        }}
      >
        <Typography id="tour-card-title" component="h2" sx={{ fontSize: 17, fontWeight: 600 }}>
          {TOUR_TITLE}
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.accentSoft }}>
          {HOW_TO_PLAY_TOUR_PROMPT}
        </Typography>
        <Button
          variant="contained"
          fullWidth
          onClick={() => setTourOpen(true)}
          sx={{ minHeight: 48, mt: 1.5 }}
        >
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
              <SettingsGroup
                key={rule.id}
                id={`rule-${rule.id}`}
                title={rule.title}
                defaultExpanded={`rule-${rule.id}` === target}
              >
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
