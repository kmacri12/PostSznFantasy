import GavelIcon from "@mui/icons-material/Gavel";
import { Box } from "@mui/material";
import { tokens } from "../../theme";
import { visuallyHidden } from "./visuallyHidden";

/** The one symbol for "commissioner"; the hidden text keeps it readable aloud (visible text first). */
const CommissionerMark = () => (
  <Box component="span" sx={{ ml: 0.5, color: tokens.warning, whiteSpace: "nowrap" }}>
    <GavelIcon aria-hidden sx={{ fontSize: "1em", verticalAlign: "-0.12em" }} />
    <Box component="span" sx={visuallyHidden}>
      , commissioner
    </Box>
  </Box>
);

export default CommissionerMark;
