import { Alert } from "@mui/material";
import { useSyncExternalStore } from "react";
import { OFFLINE_BANNER, offlineDataNote } from "../../content/rules";
import { useOnline } from "../../hooks/useOnline";
import { formatDataTime, freshAtSnapshot, subscribeFresh } from "../../utils/dataFreshness";

/** Shown while the device has no connection: what the page is showing and why changes are off. */
const OfflineBanner = () => {
  const online = useOnline();
  const freshAt = useSyncExternalStore(subscribeFresh, freshAtSnapshot, () => null);
  if (online) return null;
  return (
    <Alert severity="warning" role="status" sx={{ borderRadius: 0 }}>
      <strong>{OFFLINE_BANNER}</strong>{" "}
      {offlineDataNote(freshAt === null ? null : formatDataTime(freshAt))}
    </Alert>
  );
};

export default OfflineBanner;
