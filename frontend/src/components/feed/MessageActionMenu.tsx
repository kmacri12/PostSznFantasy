import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { FeedMessageItem } from "../../api/types";
import { tokens } from "../../theme";
import { EMOJI_GROUPS, QUICK_REACTIONS } from "./emoji";
import { canStillEdit, reactionSummary } from "./feedView";

interface Props {
  anchor: HTMLElement;
  message: FeedMessageItem;
  /** How the menu names the author, as the row does ("You" for your own). */
  author: string;
  onClose: () => void;
  onReact: (emoji: string, reacted: boolean) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const emojiButtonSx = {
  width: 44,
  height: 44,
  fontSize: 22,
  lineHeight: 1,
  borderRadius: "10px",
  fontFamily: "inherit",
} as const;

/** What a message offers: a reaction row (quick emoji, the full picker, delete), then Reply and Edit. */
const MessageActionMenu = ({
  anchor,
  message,
  author,
  onClose,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: Props) => {
  const [picking, setPicking] = useState(false);
  const mine = (emoji: string) =>
    (message.reactions ?? []).some((r) => r.emoji === emoji && r.mine);
  const react = (emoji: string) => {
    onReact(emoji, !mine(emoji));
    onClose();
  };
  const who = reactionSummary(message.reactions ?? []);

  return (
    <Popover
      open
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surfaceRaised,
            border: `1px solid ${tokens.borderStrong}`,
            borderRadius: "14px",
            maxWidth: "calc(100vw - 32px)",
          },
        },
      }}
    >
      {picking ? (
        <Box sx={{ width: 320, maxWidth: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", px: 0.5, pt: 0.5 }}>
            <IconButton
              aria-label="Back to message actions"
              onClick={() => setPicking(false)}
              sx={{ width: 44, height: 44 }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="subtitle2" component="h2">
              Pick a reaction
            </Typography>
          </Box>
          <Box sx={{ maxHeight: 300, overflowY: "auto", px: 1, pb: 1 }}>
            {EMOJI_GROUPS.map((group) => (
              <Box key={group.label} component="section" aria-label={group.label}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                  {group.label}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
                  }}
                >
                  {group.emoji.map((emoji) => (
                    <IconButton
                      key={emoji}
                      aria-label={`React with ${emoji}`}
                      aria-pressed={mine(emoji)}
                      onClick={() => react(emoji)}
                      sx={emojiButtonSx}
                    >
                      {emoji}
                    </IconButton>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <Box sx={{ minWidth: 240 }}>
          <Box
            role="toolbar"
            aria-label="React to this message"
            sx={{ display: "flex", alignItems: "center", px: 0.5, py: 0.5 }}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <IconButton
                key={emoji}
                aria-label={`React with ${emoji}`}
                aria-pressed={mine(emoji)}
                onClick={() => react(emoji)}
                sx={{
                  ...emojiButtonSx,
                  bgcolor: mine(emoji) ? tokens.accentSurface : "transparent",
                }}
              >
                {emoji}
              </IconButton>
            ))}
            <IconButton
              aria-label="Add reaction"
              onClick={() => setPicking(true)}
              sx={{ width: 44, height: 44, color: tokens.textSoft }}
            >
              <AddReactionOutlinedIcon />
            </IconButton>
            {message.canDelete && (
              <>
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ mx: 0.5, my: 1, borderColor: tokens.borderStrong }}
                />
                <IconButton
                  aria-label={`Delete message from ${author}`}
                  onClick={() => {
                    onClose();
                    onDelete();
                  }}
                  sx={{ width: 44, height: 44, borderRadius: "10px", color: tokens.muted }}
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
          {who && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", px: 1.5, pb: 0.5, maxWidth: 300 }}
            >
              {who}
            </Typography>
          )}
          <MenuList aria-label="Message actions" sx={{ pt: 0 }}>
            <MenuItem
              sx={{ minHeight: 44 }}
              onClick={() => {
                onClose();
                onReply();
              }}
            >
              <ListItemIcon>
                <ReplyIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Reply</ListItemText>
            </MenuItem>
            {canStillEdit(message) && (
              <MenuItem
                sx={{ minHeight: 44 }}
                onClick={() => {
                  onClose();
                  onEdit();
                }}
              >
                <ListItemIcon>
                  <EditOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            )}
          </MenuList>
        </Box>
      )}
    </Popover>
  );
};

export default MessageActionMenu;
