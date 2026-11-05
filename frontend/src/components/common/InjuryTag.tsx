import { Chip } from "@mui/material";
import { tokens } from "../../theme";

interface Props {
  /** Out, Doubtful, Questionable or Injured Reserve; nothing is rendered without one. */
  status?: string | null;
}

/** Words, not just colour: Out and Injured Reserve are red, the others gold. */
const InjuryTag = ({ status }: Props) => {
  if (!status) return null;
  const serious = status === "Out" || status === "Injured Reserve";
  const color = serious ? tokens.red : tokens.warning;
  return (
    <Chip
      size="small"
      variant="outlined"
      label={status}
      aria-label={`Injury status: ${status}`}
      sx={{ height: 20, fontSize: 11, color, borderColor: color, pointerEvents: "none" }}
    />
  );
};

export default InjuryTag;
