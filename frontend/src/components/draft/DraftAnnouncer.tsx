import { Box } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { DraftState } from "../../api/types";
import { visuallyHidden } from "../common/visuallyHidden";
import { type AnnouncedDraft, announcedDraft, draftAnnouncement } from "./draftAnnouncement";

interface Props {
  state: DraftState;
  myTeamId: number | null;
  secondsLeft: number | null;
}

/** The draft room's one live region: picks, who is on the clock and my pick's time warnings. */
const DraftAnnouncer = ({ state, myTeamId, secondsLeft }: Props) => {
  const [message, setMessage] = useState("");
  const previous = useRef<AnnouncedDraft | null>(null);
  const current = announcedDraft(state, myTeamId, secondsLeft);
  const key = JSON.stringify(current);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is `current` by value
  useEffect(() => {
    const next = draftAnnouncement(previous.current, current);
    previous.current = current;
    if (next) setMessage(next);
  }, [key]);

  return (
    <Box role="status" aria-label="Draft updates" sx={visuallyHidden}>
      {message}
    </Box>
  );
};

export default DraftAnnouncer;
