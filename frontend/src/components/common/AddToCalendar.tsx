import { Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { type CalendarEvent, downloadIcs, googleCalendarUrl } from "../../utils/calendar";

interface Props {
  event: CalendarEvent;
  filename: string;
  label?: string;
}

/** One tap to a calendar entry with a reminder: an .ics for Apple and Outlook, or Google's link. */
const AddToCalendar = ({ event, filename, label = "Add to calendar" }: Props) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <Button
        variant="outlined"
        sx={{ minHeight: 44, alignSelf: "flex-start" }}
        aria-haspopup="menu"
        onClick={(click) => setAnchor(click.currentTarget)}
      >
        {label}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        <MenuItem
          sx={{ minHeight: 44 }}
          onClick={() => {
            downloadIcs(event, filename);
            close();
          }}
        >
          Apple or Outlook (.ics file)
        </MenuItem>
        <MenuItem
          component="a"
          sx={{ minHeight: 44 }}
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          Google Calendar
        </MenuItem>
      </Menu>
    </>
  );
};

export default AddToCalendar;
