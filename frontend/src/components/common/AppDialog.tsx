import { Dialog, type DialogProps } from "@mui/material";
import { useBackClosesOverlay } from "../../hooks/useBackClosesOverlay";

/** A MUI Dialog that the browser back button closes instead of leaving the page. */
const AppDialog = ({ open, onClose, ...rest }: DialogProps) => {
  useBackClosesOverlay(() => onClose?.({}, "escapeKeyDown"), open);
  return <Dialog open={open} onClose={onClose} {...rest} />;
};

export default AppDialog;
