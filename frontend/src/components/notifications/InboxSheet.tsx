import { Box, ButtonBase, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarkInboxRead } from "../../api/queries";
import type { Inbox } from "../../api/types";
import { tokens } from "../../theme";
import { formatAgo } from "../common/LiveStatsNotice";
import { NewActivityDot } from "../layout/NewActivityDot";
import SettingsSheet from "../settings/SettingsSheet";
import { describeNotification } from "./inboxView";

interface Props {
  inbox: Inbox | undefined;
  onClose: () => void;
}

/**
 * The last 30 days of what was addressed to me. Opening it marks everything read, so the bell's
 * count goes with one tap; what was unread on opening keeps its dot until the sheet closes.
 */
const InboxSheet = ({ inbox, onClose }: Props) => {
  const navigate = useNavigate();
  const markRead = useMarkInboxRead();
  const items = inbox?.items ?? [];
  const [newOnOpen, setNewOnOpen] = useState<Set<number> | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    if (!inbox || newOnOpen) return;
    setNewOnOpen(new Set(inbox.items.filter((item) => !item.read).map((item) => item.id)));
    if (inbox.unreadCount > 0 && !marked.current) {
      marked.current = true;
      markRead.mutate(undefined);
    }
  }, [inbox, newOnOpen, markRead]);

  const open = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <SettingsSheet title="Notifications" onClose={onClose}>
      {inbox && items.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Nothing in the last 30 days. Your draft turns, lineup reminders and commissioner changes
          to your lineup show up here.
        </Typography>
      )}
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.5 }}>
        {items.map((item) => {
          const line = describeNotification(item);
          const unread = newOnOpen?.has(item.id) ?? !item.read;
          return (
            <li key={item.id}>
              <ButtonBase
                onClick={() => open(line.path)}
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
                  bgcolor: unread ? tokens.accentSurface : "transparent",
                }}
              >
                <Box sx={{ width: 8, pt: 0.9, flex: "none" }}>
                  {unread && <NewActivityDot label="Unread" />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: unread ? 700 : 500, color: tokens.text }}>
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
