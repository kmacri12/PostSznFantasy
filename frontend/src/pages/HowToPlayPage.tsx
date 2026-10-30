import { Box, Container, Link as MuiLink, Paper, Typography } from "@mui/material";
import { HOW_TO_PLAY_INTRO, HOW_TO_PLAY_LABEL, HOW_TO_PLAY_SECTIONS } from "../content/rules";

/** The rules in plain language; the copy lives in content/rules.ts. */
const HowToPlayPage = () => (
  <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
    <Typography variant="h4" component="h1" gutterBottom>
      {HOW_TO_PLAY_LABEL}
    </Typography>
    <Typography sx={{ mb: 2 }}>{HOW_TO_PLAY_INTRO}</Typography>
    <Box
      component="nav"
      aria-label="Sections"
      sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}
    >
      {HOW_TO_PLAY_SECTIONS.map((section) => (
        <MuiLink
          key={section.id}
          href={`#${section.id}`}
          underline="hover"
          sx={{ display: "inline-flex", alignItems: "center", minHeight: 44, pr: 1.5 }}
        >
          {section.title}
        </MuiLink>
      ))}
    </Box>
    <Box sx={{ display: "grid", gap: 2 }}>
      {HOW_TO_PLAY_SECTIONS.map((section) => (
        <Paper
          key={section.id}
          component="section"
          id={section.id}
          sx={{ p: 2, scrollMarginTop: 80 }}
        >
          <Typography variant="h6" component="h2" gutterBottom>
            {section.title}
          </Typography>
          {section.body.map((paragraph) => (
            <Typography key={paragraph} sx={{ mb: 1, maxWidth: "65ch" }}>
              {paragraph}
            </Typography>
          ))}
        </Paper>
      ))}
    </Box>
  </Container>
);

export default HowToPlayPage;
