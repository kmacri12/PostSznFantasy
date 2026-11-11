import { Alert, Button } from "@mui/material";
import { UPDATE_AVAILABLE, UPDATE_OUTDATED, UPDATE_REFRESH } from "../../content/rules";
import { useAppUpdate } from "../../hooks/useAppUpdate";

/**
 * "Update available, tap to refresh" after a deploy, or "please refresh" when the API no longer
 * supports this tab. Refreshing is always the member's tap, never automatic.
 */
const UpdateBanner = () => {
  const update = useAppUpdate();
  if (update === "none") return null;
  return (
    <Alert
      severity="info"
      role="status"
      sx={{ borderRadius: 0 }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => window.location.reload()}
          sx={{ minHeight: 44, minWidth: 44 }}
        >
          {UPDATE_REFRESH}
        </Button>
      }
    >
      {update === "outdated" ? UPDATE_OUTDATED : UPDATE_AVAILABLE}
    </Alert>
  );
};

export default UpdateBanner;
