import { Box, Button, Dialog, Typography, useMediaQuery, useTheme } from "@mui/material";
import { TOUR_SKIP, TOUR_TITLE } from "../../content/rules";
import TourViewer from "./TourViewer";

interface Props {
  onClose: () => void;
}

/** The tour over the app: full screen on phones, a dialog from `sm` up. Skip is always there. */
const TourDialog = ({ onClose }: Props) => {
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { "aria-label": TOUR_TITLE } }}
    >
      <Box sx={{ p: 2, display: "grid", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" component="h2">
            {TOUR_TITLE}
          </Typography>
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            {TOUR_SKIP}
          </Button>
        </Box>
        <TourViewer fill onFinish={onClose} />
      </Box>
    </Dialog>
  );
};

export default TourDialog;
