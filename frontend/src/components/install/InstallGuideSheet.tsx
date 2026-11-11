import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import IosShareIcon from "@mui/icons-material/IosShare";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import { Alert, Box, Button, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import {
  INSTALL_DONE,
  INSTALL_IN_APP_BROWSER,
  INSTALL_INSTALLED,
  INSTALL_NATIVE_BUTTON,
  INSTALL_NOT_NOW,
  INSTALL_STEPS,
  INSTALL_TITLE,
  INSTALL_WHY,
} from "../../content/rules";
import { tokens } from "../../theme";
import { isInAppBrowser } from "../../utils/inAppBrowser";
import { installKind, promptInstall, subscribeInstall } from "../../utils/install";
import SettingsSheet from "../settings/SettingsSheet";

const STEP_ICONS: Record<string, ReactNode> = {
  share: <IosShareIcon />,
  menu: <MoreVertIcon />,
  add: <AddBoxOutlinedIcon />,
  open: <PhoneIphoneIcon />,
};

const Step = ({ number, icon, text }: { number: number; icon: string; text: string }) => (
  <Box
    component="li"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      p: 1.5,
      minHeight: 56,
      listStyle: "none",
      borderRadius: 2,
      border: `1px solid ${tokens.border}`,
      bgcolor: tokens.surface,
    }}
  >
    <Box
      aria-hidden
      sx={{
        display: "grid",
        placeItems: "center",
        flex: "none",
        width: 44,
        height: 44,
        borderRadius: 2,
        bgcolor: "action.hover",
        color: tokens.accent,
      }}
    >
      {STEP_ICONS[icon]}
    </Box>
    <Typography variant="body2">
      <strong>{number}. </strong>
      {text}
    </Typography>
  </Box>
);

interface Props {
  onClose: () => void;
}

/**
 * How to put PostSzn on the Home Screen: Chrome's own install dialog when the browser offers it,
 * otherwise the steps for this device (iPhone has no install API, so Share, Add to Home Screen).
 */
const InstallGuideSheet = ({ onClose }: Props) => {
  const kind = useSyncExternalStore(subscribeInstall, installKind, () => "desktop" as const);
  const [busy, setBusy] = useState(false);

  const install = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") onClose();
    } finally {
      setBusy(false);
    }
  };

  const steps =
    kind === "ios" || kind === "android" || kind === "desktop" ? INSTALL_STEPS[kind] : [];
  return (
    <SettingsSheet title={INSTALL_TITLE} onClose={onClose} closeLabel="Close">
      {kind === "installed" ? (
        <Typography>{INSTALL_INSTALLED}</Typography>
      ) : (
        <>
          <Typography color="text.secondary">{INSTALL_WHY}</Typography>
          {kind === "ios" && isInAppBrowser() && (
            <Alert severity="info">{INSTALL_IN_APP_BROWSER}</Alert>
          )}
          {kind === "native" ? (
            <Button
              variant="contained"
              sx={{ minHeight: 48 }}
              disabled={busy}
              onClick={() => void install()}
            >
              {INSTALL_NATIVE_BUTTON}
            </Button>
          ) : (
            <Box component="ol" sx={{ display: "grid", gap: 1, m: 0, p: 0 }}>
              {steps.map((step, index) => (
                <Step key={step.text} number={index + 1} icon={step.icon} text={step.text} />
              ))}
            </Box>
          )}
        </>
      )}
      <Button variant="outlined" sx={{ minHeight: 48 }} onClick={onClose}>
        {kind === "installed" ? INSTALL_DONE : INSTALL_NOT_NOW}
      </Button>
    </SettingsSheet>
  );
};

export default InstallGuideSheet;
