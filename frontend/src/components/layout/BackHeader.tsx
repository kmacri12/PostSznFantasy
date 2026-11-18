import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, IconButton, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  /** Where Back goes when the member has no history here (opened from a link or a push). */
  fallback: string;
}

/** The top of a page reached from a tab that is not a tab itself: a back arrow and the title. */
const BackHeader = ({ title, fallback }: Props) => {
  const navigate = useNavigate();
  // The data router counts entries in `history.state.idx`; 0 means the page was opened directly.
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback));
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 2, ml: -1 }}>
      <IconButton aria-label="Back" onClick={goBack} sx={{ width: 44, height: 44 }}>
        <ArrowBackIcon />
      </IconButton>
      <Typography variant="h1" sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700 }}>
        {title}
      </Typography>
    </Box>
  );
};

export default BackHeader;
