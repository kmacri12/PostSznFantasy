import { Box } from "@mui/material";
import { Link } from "react-router-dom";
import Logo from "../common/Logo";

/** The full logo, always: it opens the leagues page. The league switcher sits on the other side of the bar. */
const Brand = ({ inLeague = false }: { inLeague?: boolean }) => (
  <Box
    component={Link}
    to="/"
    aria-label={inLeague ? "PostSzn Fantasy, your leagues" : "PostSzn Fantasy"}
    sx={{
      flex: "none",
      display: "flex",
      alignItems: "center",
      textDecoration: "none",
      // Keeps the visual logo compact but gives the link the 44px touch target.
      position: "relative",
      "&::after": { content: '""', position: "absolute", inset: "-6px -4px" },
    }}
  >
    <Logo variant="lockup" size={34} />
  </Box>
);

export default Brand;
