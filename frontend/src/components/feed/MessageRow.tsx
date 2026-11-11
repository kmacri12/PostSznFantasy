import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { Box, ButtonBase, IconButton } from "@mui/material";
import { type KeyboardEvent, type MouseEvent, useRef, useState } from "react";
import type { FeedMessageItem } from "../../api/types";
import { useLongPress } from "../../hooks/useLongPress";
import { tokens } from "../../theme";
import { visuallyHidden } from "../common/visuallyHidden";
import { timeLabel } from "./feedView";
import MessageActionMenu from "./MessageActionMenu";
import { segmentBody } from "./mentions";

interface Props {
  message: FeedMessageItem;
  own: boolean;
  /** The viewer may act on messages: reactions, reply, edit and delete. Off in an archive. */
  interactive: boolean;
  onReact: (message: FeedMessageItem, emoji: string, reacted: boolean) => void;
  onReply: (message: FeedMessageItem) => void;
  onEdit: (message: FeedMessageItem) => void;
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

const Quote = ({ quote }: { quote: NonNullable<FeedMessageItem["replyTo"]> }) => (
  <Box
    sx={{
      borderLeft: `3px solid ${tokens.accentBorder}`,
      pl: 1,
      fontSize: 12,
      color: tokens.muted,
      minWidth: 0,
    }}
  >
    {quote.deleted ? (
      <Box component="em">The original message was deleted.</Box>
    ) : (
      <>
        <Box component="strong" sx={{ color: tokens.textSoft }}>
          {quote.authorName ?? "Former member"}
        </Box>
        <Box
          sx={{
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {quote.snippet}
        </Box>
      </>
    )}
  </Box>
);

/** One chat message: author and time above a bubble, the author's own on the right. A long
 * press, right-click, Enter on the bubble or the "more" button opens its actions. */
const MessageRow = ({
  message,
  own,
  interactive,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onGifLoad,
}: Props) => {
  const author = own ? "You" : (message.authorName ?? "Former member");
  const bubble = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = (target: HTMLElement | null) => {
    if (interactive && target) setAnchor(target);
  };
  const longPress = useLongPress(open);

  const onContextMenu = (event: MouseEvent) => {
    if (!interactive) return;
    event.preventDefault();
    open(bubble.current);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const opens =
      event.key === "Enter" ||
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10");
    if (interactive && opens && event.target === event.currentTarget) {
      event.preventDefault();
      open(bubble.current);
    }
  };

  return (
    <Box
      component="li"
      id={`message-${message.id}`}
      sx={{
        listStyle: "none",
        display: "flex",
        alignItems: "flex-end",
        gap: 0.5,
        flexDirection: own ? "row-reverse" : "row",
        alignSelf: own ? "flex-end" : "flex-start",
        maxWidth: "88%",
        position: "relative",
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
          {message.editedAt && (
            <Box component="span" title={`Edited ${timeLabel(message.editedAt)}`} sx={{ ml: 0.75 }}>
              edited
            </Box>
          )}
        </Box>
        <Box
          ref={bubble}
          role="group"
          aria-label={
            interactive
              ? `Message from ${author}. Press Enter for actions.`
              : `Message from ${author}`
          }
          tabIndex={interactive ? 0 : undefined}
          onContextMenu={onContextMenu}
          onKeyDown={onKeyDown}
          {...(interactive ? longPress : {})}
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
            WebkitTouchCallout: "none",
            // A press-and-hold must open the menu, not start a text selection.
            "@media (pointer: coarse)": { userSelect: "none", WebkitUserSelect: "none" },
          }}
        >
          {message.replyTo && <Quote quote={message.replyTo} />}
          {message.body && (
            <Box sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {segmentBody(message.body, message.mentions ?? []).map((segment, index) =>
                segment.mention ? (
                  <Box
                    // biome-ignore lint/suspicious/noArrayIndexKey: segments of one string, never reordered
                    key={index}
                    component="strong"
                    sx={{ color: tokens.accent, fontWeight: 600 }}
                  >
                    {segment.text}
                  </Box>
                ) : (
                  segment.text
                ),
              )}
            </Box>
          )}
          {message.gifUrl && <Gif url={message.gifUrl} author={author} onLoad={onGifLoad} />}
        </Box>
        {(message.reactions ?? []).length > 0 && (
          <Box
            role="group"
            aria-label="Reactions"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              justifyContent: own ? "flex-end" : "flex-start",
            }}
          >
            {(message.reactions ?? []).map((reaction) => (
              <ButtonBase
                key={reaction.emoji}
                disabled={!interactive}
                aria-pressed={reaction.mine}
                aria-label={`${reaction.emoji} ${reaction.count}, ${reaction.names.join(", ")}. ${
                  reaction.mine ? "Remove your reaction" : "Add your reaction"
                }`}
                title={reaction.names.join(", ")}
                onClick={() => onReact(message, reaction.emoji, !reaction.mine)}
                // The pill is 26px tall; the button around it is the 44px touch target.
                sx={{ minHeight: 44, minWidth: 44, my: "-9px" }}
              >
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    height: 26,
                    px: 1,
                    borderRadius: "13px",
                    fontSize: 13,
                    border: `1px solid ${reaction.mine ? tokens.accentBorder : tokens.border}`,
                    bgcolor: reaction.mine ? tokens.accentSurface : tokens.surface,
                    color: tokens.textSoft,
                  }}
                >
                  <span aria-hidden="true">{reaction.emoji}</span>
                  <span aria-hidden="true">{reaction.count}</span>
                </Box>
              </ButtonBase>
            ))}
          </Box>
        )}
      </Box>
      {interactive && (
        <IconButton
          aria-label={`Message actions from ${author}`}
          aria-haspopup="menu"
          // The bubble is the keyboard stop; this is the visible route for a mouse and
          // for screen readers, and it stays out of the way on touch screens.
          tabIndex={-1}
          onClick={() => open(bubble.current)}
          sx={{
            color: tokens.muted,
            width: 44,
            height: 44,
            flex: "none",
            opacity: 0,
            "li:hover > &, li:focus-within > &, &:focus-visible": { opacity: 1 },
            "@media (pointer: coarse)": {
              ...visuallyHidden,
              "&:focus-visible": { width: 44, height: 44, clip: "auto" },
            },
          }}
        >
          <MoreHorizIcon fontSize="small" />
        </IconButton>
      )}
      {anchor && (
        <MessageActionMenu
          anchor={anchor}
          message={message}
          author={author}
          onClose={() => setAnchor(null)}
          onReact={(emoji, reacted) => onReact(message, emoji, reacted)}
          onReply={() => onReply(message)}
          onEdit={() => onEdit(message)}
          onDelete={() => onDelete(message)}
        />
      )}
    </Box>
  );
};

export default MessageRow;
