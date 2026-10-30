import { Alert } from "@mui/material";
import { exhaustionWarnings } from "../../utils/exhaustion";

const ExhaustionWarning = ({
  settings,
}: {
  settings: { number_teams: number; [key: string]: number };
}) => {
  const warnings = exhaustionWarnings(settings);
  if (warnings.length === 0) return null;
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      {warnings.map((warning) => (
        <div key={warning}>{warning}</div>
      ))}
    </Alert>
  );
};

export default ExhaustionWarning;
