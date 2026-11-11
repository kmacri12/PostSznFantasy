import type { Toast } from "../../hooks/draftRoomState";
import AppToast from "../common/AppToast";

interface Props {
  toast: Toast | null;
  onClose: () => void;
}

const DraftToast = ({ toast, onClose }: Props) => (
  <AppToast
    key={toast?.id}
    open={toast !== null}
    message={toast?.message ?? ""}
    severity={toast?.severity ?? "error"}
    onClose={onClose}
  />
);

export default DraftToast;
