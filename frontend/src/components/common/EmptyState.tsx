import { Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** The next step, e.g. a button or link. */
  action?: ReactNode;
}

const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <Paper sx={{ p: { xs: 3, sm: 4 }, textAlign: "center" }}>
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
