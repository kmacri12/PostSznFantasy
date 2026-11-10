import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import { isTourTrigger, markTourSeen, tourSeen } from "../../utils/tourSeen";
import TourDialog from "./TourDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A name or team-name prompt is up; the tour waits for it. */
  blocked?: boolean;
}

/**
 * Shows the tour once per account on this device, right after joining or creating a league.
 * Opening counts as seen, so skipping it or closing the tab never brings it back.
 */
const FirstRunTour = ({ open, onOpenChange, blocked = false }: Props) => {
  const { userId } = useUser();
  const { state } = useLocation();

  useEffect(() => {
    if (blocked || userId === null || !isTourTrigger(state) || tourSeen(userId)) return;
    markTourSeen(userId);
    onOpenChange(true);
  }, [userId, state, onOpenChange, blocked]);

  return open ? <TourDialog onClose={() => onOpenChange(false)} /> : null;
};

export default FirstRunTour;
