import { Box, Button, Typography } from "@mui/material";
import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <Box sx={{ p: 4, textAlign: "center" }}>
    <Typography variant="h5" component="h2">
      404 - Page Not Found
    </Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
      The requested page does not exist.
    </Typography>
    <Button component={Link} to="/" variant="contained">
      Go to your leagues
    </Button>
  </Box>
);

export default NotFoundPage;
