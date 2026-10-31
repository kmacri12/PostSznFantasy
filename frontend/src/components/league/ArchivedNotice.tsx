import { Alert } from "@mui/material";

/** Shown where write controls are hidden: finished leagues answer every write with 409. */
const ArchivedNotice = ({ what }: { what: string }) => (
  <Alert severity="info" sx={{ mb: 2 }}>
    This league is archived: the season is over, so {what} can no longer be changed.
  </Alert>
);

export default ArchivedNotice;
