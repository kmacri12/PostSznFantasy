import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { Box, IconButton } from "@mui/material";
import { useState } from "react";
import type { FeedMessageItem } from "../../api/types";
import { tokens } from "../../theme";
import { timeLabel } from "./feedView";

interface Props {
  message: FeedMessageItem;
  own: boolean;
  onDelete: (message: FeedMessageItem) => void;
  /** A GIF finished loading and grew the row, so a feed pinned to the bottom must follow. */
  onGifLoad?: () => void;
}

const Gif = ({ url, author, onLoad }: { url: string; author: string; onLoad?: () => void }) => {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Box sx={{ fontSize: 12, color: tokens.muted }}>The GIF couldn't be loaded.</Box>
  ) : (
    <Box
      component="img"
      src={url}
      alt={`GIF from ${author}`}
      loading="lazy"
      onLoad={onLoad}
      onError={() => setFailed(true)}
      sx={{ display: "block", maxWidth: "100%", maxHeight: 220, borderRadius: "12px" }}
    />
  );
};

/** One chat message: author and time above a bubble, the author's own on the right. */
const MessageRow = ({ message, own, onDelete, onGifLoad }: Props) => {
  const author = own ? "You" : (message.authorName ?? "Former member");
  return (
    <Box
      component="li"
      sx={{
        listStyle: "none",
        display: "flex",
        alignItems: "flex-end",
        gap: 0.5,
        flexDirection: own ? "row-reverse" : "row",
        alignSelf: own ? "flex-end" : "flex-start",
        maxWidth: "88%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          alignItems: own ? "flex-end" : "flex-start",
          minWidth: 0,
        }}
      >
        <Box sx={{ fontSize: 11, color: tokens.muted }}>
          {author}
          <Box component="time" dateTime={message.createdAt} sx={{ ml: 0.75 }}>
            {timeLabel(message.createdAt)}
          </Box>
        </Box>
        <Box
          sx={{
            bgcolor: own ? tokens.accentSurface : tokens.surfaceRaised,
            border: own ? `1px solid ${tokens.accentBorder}` : "1px solid transparent",
            borderRadius: own ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            px: 1.5,
            py: "9px",
            fontSize: 14,
            lineHeight: 1.4,
            display: "grid",
            gap: 1,
            minWidth: 0,
          }}
        >
          {message.body && (
            <Box sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</Box>
          )}
          {message.gifUrl && <Gif url={message.gifUrl} author={author} onLoad={onGifLoad} />}
        </Box>
      </Box>
      {message.canDelete && (
        <IconButton
          aria-label={`Delete message from ${author}`}
          onClick={() => onDelete(message)}
          sx={{ color: tokens.muted, width: 44, height: 44, flex: "none" }}
        >
          <DeleteOutlinedIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

export default MessageRow;
