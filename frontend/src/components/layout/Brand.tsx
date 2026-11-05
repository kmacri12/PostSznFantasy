import { Box } from "@mui/material";
import { Link } from "react-router-dom";
import { radii, tokens } from "../../theme";

/** The logo always opens the leagues page. Inside a league it is the square mark (a placeholder). */
const Brand = ({ wide = false }: { wide?: boolean }) => (
  <Box
    component={Link}
    to="/"
    aria-label={wide ? "PostSzn Fantasy" : "PostSzn Fantasy, your leagues"}
    sx={{
      height: 32,
      minWidth: 32,
      px: wide ? 1.5 : 0,
      flex: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: `${radii.mark}px`,
      bgcolor: tokens.accent,
      color: tokens.accentInk,
      fontSize: wide ? 14 : 13,
      fontWeight: 700,
      textDecoration: "none",
      whiteSpace: "nowrap",
      // Keeps the 32px visual mark but gives the link the 44px touch target.
      position: "relative",
      "&::after": { content: '""', position: "absolute", inset: -6 },
    }}
  >
    {wide ? "PostSzn Fantasy" : "PS"}
  </Box>
);

export default Brand;
