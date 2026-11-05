import { Box } from "@mui/material";
import { Link } from "react-router-dom";
import Logo from "../common/Logo";

/** The logo always opens the leagues page. Inside a league it is the 32px tile; elsewhere the lockup. */
const Brand = ({ wide = false }: { wide?: boolean }) => (
  <Box
    component={Link}
    to="/"
    aria-label={wide ? "PostSzn Fantasy" : "PostSzn Fantasy, your leagues"}
    sx={{
      flex: "none",
      display: "flex",
      alignItems: "center",
      textDecoration: "none",
      // Keeps the visual mark small but gives the link the 44px touch target.
      position: "relative",
      "&::after": { content: '""', position: "absolute", inset: -6 },
    }}
  >
    {wide ? <Logo variant="lockup" size={40} /> : <Logo tile size={32} />}
  </Box>
);

export default Brand;
