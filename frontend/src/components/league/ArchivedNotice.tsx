import { Alert } from "@mui/material";

/** Shown where write controls are hidden: a finished season answers every write with 409. */
const ArchivedNotice = ({ what }: { what: string }) => (
  <Alert severity="info" sx={{ mb: 2 }}>
    This season is over and archived, so {what} can no longer be changed.
  </Alert>
);

export default ArchivedNotice;
