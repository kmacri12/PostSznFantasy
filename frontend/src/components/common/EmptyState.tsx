import { Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";
import Illustration, { type IllustrationName } from "./Illustration";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** A small drawing above the title. */
  illustration?: IllustrationName;
  /** The one next step, e.g. a button or link. */
  action?: ReactNode;
}

const EmptyState = ({ title, description, illustration, action }: EmptyStateProps) => (
  <Paper sx={{ p: { xs: 3, sm: 4 }, textAlign: "center" }}>
    {illustration && <Illustration name={illustration} />}
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      {title}
    </Typography>
    {description && (
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {description}
      </Typography>
    )}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </Paper>
);

export default EmptyState;
