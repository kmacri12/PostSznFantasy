import IosShareIcon from "@mui/icons-material/IosShare";
import { Button } from "@mui/material";
import { useState } from "react";
import { useThemeMode } from "../../contexts/ThemeModeContext";
import { createLogger } from "../../utils/logger";
import { shareImage } from "../../utils/shareImage";
import AppToast from "../common/AppToast";
import { renderShareCard } from "./renderCard";
import type { ShareCard } from "./shareCards";

const logger = createLogger("share-card");

/** Renders the card as a picture in the current theme, then shares it or saves it. */
const ShareCardButton = ({ card, label }: { card: ShareCard | null; label: string }) => {
  const { mode } = useThemeMode();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(
    null,
  );
  if (!card) return null;

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderShareCard(card, mode);
      const result = await shareImage(blob, card.fileName, card.eyebrow);
      if (result === "downloaded") setToast({ message: "Picture saved.", severity: "success" });
    } catch (error) {
      logger.warn("share card failed", { error: String(error) });
      setToast({ message: "Couldn't make the picture. Try again.", severity: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<IosShareIcon aria-hidden />}
        disabled={busy}
        onClick={share}
        sx={{ minHeight: 44, alignSelf: "flex-start" }}
      >
        {label}
      </Button>
      <AppToast
        open={toast !== null}
        message={toast?.message ?? ""}
        severity={toast?.severity}
        onClose={() => setToast(null)}
      />
    </>
  );
};

export default ShareCardButton;
