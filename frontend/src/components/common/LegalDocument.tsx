import { Container, Typography } from "@mui/material";
import type { ReactNode } from "react";

export type LegalSection = { heading: string; body: ReactNode[] };

const LegalDocument = ({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) => (
  <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
    <Typography variant="h4" component="h1">
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
      Last updated {updated}
    </Typography>
    {sections.map((section) => (
      <section key={section.heading}>
        <Typography variant="h6" component="h2" sx={{ mt: 3, mb: 1 }}>
          {section.heading}
        </Typography>
        {section.body.map((paragraph, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
          <Typography key={index} color="text.secondary" sx={{ mb: 1.5 }}>
            {paragraph}
          </Typography>
        ))}
      </section>
    ))}
  </Container>
);

export default LegalDocument;
