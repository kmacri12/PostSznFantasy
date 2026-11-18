import { Chip } from "@mui/material";
import { tokens } from "../../theme";

interface Props {
  /** Out, Doubtful, Questionable or Injured Reserve; nothing is rendered without one. */
  status?: string | null;
  /** One to two letters (Q, D, O, IR) for a row that must not grow; the full word stays in its name. */
  compact?: boolean;
}

const CODES: Record<string, string> = {
  Out: "O",
  Doubtful: "D",
  Questionable: "Q",
  "Injured Reserve": "IR",
};

/** Words, not just colour: Out and Injured Reserve are red, the others gold. */
const InjuryTag = ({ status, compact = false }: Props) => {
  if (!status) return null;
  const serious = status === "Out" || status === "Injured Reserve";
  const color = serious ? tokens.red : tokens.warning;
  return (
    <Chip
      size="small"
      variant="outlined"
      label={compact ? (CODES[status] ?? status) : status}
      aria-label={`Injury status: ${status}`}
      title={status}
      sx={{
        height: compact ? 16 : 20,
        fontSize: compact ? 10 : 11,
        fontWeight: compact ? 700 : 400,
        color,
        borderColor: color,
        pointerEvents: "none",
        flexShrink: 0,
        "& .MuiChip-label": compact ? { px: 0.5 } : undefined,
      }}
    />
  );
};

export default InjuryTag;
