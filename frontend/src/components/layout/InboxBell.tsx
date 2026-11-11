import { Badge, IconButton } from "@mui/material";
import { useState } from "react";
import { useInbox } from "../../api/queries";
import { tokens } from "../../theme";
import InboxSheet from "../notifications/InboxSheet";
import { strokeIcon } from "./TabIcons";

const BellIcon = strokeIcon(
  <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
);

/** The header bell: the unread count, and the inbox sheet on a tap. */
const InboxBell = () => {
  const { data } = useInbox(true);
  const [open, setOpen] = useState(false);
  const unread = data?.unreadCount ?? 0;

  return (
    <>
      <IconButton
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        sx={{ width: 44, height: 44, color: tokens.textSoft }}
      >
        <Badge
          badgeContent={unread}
          max={99}
          color="error"
          // The count is in the button's name already; the badge is only what it looks like.
          slotProps={{ badge: { "aria-hidden": true } }}
        >
          <BellIcon />
        </Badge>
      </IconButton>
      {open && <InboxSheet inbox={data} onClose={() => setOpen(false)} />}
    </>
  );
};

export default InboxBell;
