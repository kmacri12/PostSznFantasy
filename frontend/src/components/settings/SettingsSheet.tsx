import { Box, Button, Dialog, Drawer, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}

/** A bottom sheet on phones and a centered dialog on larger screens. */
const SettingsSheet = ({ title, onClose, closeLabel = "Done", children }: Props) => {
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  const content = (
    <Box sx={{ p: 2, pt: phone ? 1 : 2, display: "grid", gap: 1.5 }}>
      {phone && (
        <Box
          aria-hidden
          sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider", mx: "auto", mb: 0.5 }}
        />
      )}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          {closeLabel}
        </Button>
      </Box>
      {children}
    </Box>
  );

  return phone ? (
    <Drawer
      anchor="bottom"
      open
      onClose={onClose}
      slotProps={{
        paper: {
          "aria-label": title,
          sx: {
            borderRadius: "20px 20px 0 0",
            maxHeight: "90dvh",
            border: 1,
            borderColor: "divider",
          },
        },
      }}
    >
      {content}
    </Drawer>
  ) : (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { "aria-label": title } }}
    >
      {content}
    </Dialog>
  );
};

export default SettingsSheet;
