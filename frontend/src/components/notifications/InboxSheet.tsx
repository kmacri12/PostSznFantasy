import { Box, Button, ButtonBase, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useMarkInboxRead } from "../../api/queries";
import type { Inbox, InboxItem } from "../../api/types";
import { tokens } from "../../theme";
import { formatAgo } from "../common/DataFreshness";
import { NewActivityDot } from "../layout/NewActivityDot";
import SettingsSheet from "../settings/SettingsSheet";
import { describeNotification } from "./inboxView";

interface Props {
  inbox: Inbox | undefined;
  onClose: () => void;
}

/** The last 30 days of what was addressed to me; tapping one marks it read and opens its page. */
const InboxSheet = ({ inbox, onClose }: Props) => {
  const navigate = useNavigate();
  const markRead = useMarkInboxRead();
  const items = inbox?.items ?? [];

  const open = (item: InboxItem, path: string) => {
    if (!item.read) markRead.mutate([item.id]);
    onClose();
    navigate(path);
  };

  return (
    <SettingsSheet title="Notifications" onClose={onClose}>
      {(inbox?.unreadCount ?? 0) > 0 && (
        <Button
          onClick={() => markRead.mutate(undefined)}
          disabled={markRead.isPending}
          sx={{ minHeight: 44, justifySelf: "start" }}
        >
          Mark all as read
        </Button>
      )}
      {inbox && items.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Nothing in the last 30 days. Your draft turns, lineup reminders and commissioner changes
          to your lineup show up here.
        </Typography>
      )}
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}>
        {items.map((item) => {
          const line = describeNotification(item);
          return (
            <li key={item.id}>
              <ButtonBase
                onClick={() => open(item, line.path)}
                sx={{
                  width: "100%",
                  minHeight: 56,
                  px: 1.5,
                  py: 1,
                  gap: 1.25,
                  borderRadius: 2,
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  textAlign: "left",
                  bgcolor: item.read ? "transparent" : tokens.accentSurface,
                }}
              >
                <Box sx={{ width: 8, pt: 0.9, flex: "none" }}>
                  {!item.read && <NewActivityDot label="Unread" />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: item.read ? 500 : 700, color: tokens.text }}>
                    {line.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: tokens.textSoft }}>
                    {line.body}
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  component="time"
                  dateTime={item.createdAt}
                  sx={{ color: tokens.muted, flex: "none", pt: 0.25 }}
                >
                  {formatAgo(item.createdAt)}
                </Typography>
              </ButtonBase>
            </li>
          );
        })}
      </Box>
    </SettingsSheet>
  );
};

export default InboxSheet;
