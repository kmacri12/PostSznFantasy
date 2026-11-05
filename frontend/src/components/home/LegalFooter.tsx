import { Box, Link as MuiLink } from "@mui/material";
import { Link } from "react-router-dom";

/** Privacy and Terms live only here: on the landing and leagues pages. */
const LegalFooter = () => (
  <Box
    component="footer"
    sx={{ display: "flex", gap: 3, justifyContent: "center", py: 1, mt: "auto" }}
  >
    <MuiLink
      component={Link}
      to="/privacy"
      color="text.secondary"
      underline="none"
      sx={{ py: 1.5 }}
    >
      Privacy
    </MuiLink>
    <MuiLink component={Link} to="/terms" color="text.secondary" underline="none" sx={{ py: 1.5 }}>
      Terms
    </MuiLink>
  </Box>
);

export default LegalFooter;
