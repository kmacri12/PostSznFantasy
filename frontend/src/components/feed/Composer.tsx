import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { Alert, Box, IconButton, InputBase, Typography } from "@mui/material";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEditMessage, usePostMessage } from "../../api/queries";
import type { FeedMessageItem, MemberSummary } from "../../api/types";
import { tokens } from "../../theme";
import { gifProvider } from "../../utils/gifProvider";
import AppToast from "../common/AppToast";
import { mutationError } from "../common/friendlyError";
import GifPicker from "./GifPicker";
import {
  insertMention,
  type MentionQuery,
  mentionQuery,
  stillMentioned,
  suggestMembers,
} from "./mentions";

export const MAX_MESSAGE_LENGTH = 2000;

const roundButtonSx = {
  width: 44,
  height: 44,
  flex: "none",
  border: `1px solid ${tokens.borderStrong}`,
  color: tokens.textSoft,
  fontSize: 12,
  fontWeight: 700,
} as const;

const finePointer = () => window.matchMedia?.("(pointer: fine)").matches ?? false;

interface Props {
  seasonId: number;
  /** Active league members the @ autocomplete offers. */
  members: MemberSummary[];
  selfId: number | null;
  /** The message being answered; its quote shows above the box and rides along on Send. */
  replyTo: FeedMessageItem | null;
  /** The own message being edited: the box holds its text and Send saves it. */
  editing: FeedMessageItem | null;
  onDone: () => void;
}

const quoteLabel = (message: FeedMessageItem) =>
  `${message.authorName ?? "Former member"}: ${message.body || "GIF"}`;

/** The message box: text, an optional GIF, @mention suggestions, and a send button.
 * Enter sends with a mouse. */
const Composer = ({ seasonId, members, selfId, replyTo, editing, onDone }: Props) => {
  const [text, setText] = useState(editing?.body ?? "");
  const [picking, setPicking] = useState(false);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const picked = useRef(new Map<number, string>());
  const input = useRef<HTMLTextAreaElement | null>(null);
  const author = members.find((member) => member.userId === selfId);
  const post = usePostMessage(
    seasonId,
    author ? { userId: author.userId, name: author.username } : undefined,
  );
  const [failed, setFailed] = useState(false);
  const edit = useEditMessage(seasonId);
  const provider = gifProvider();
  const body = text.trim();
  const pending = post.isPending || edit.isPending;

  // Editing swaps the box's text for the message's; a reply keeps what was already typed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the edited message changes
  useEffect(() => {
    for (const mention of editing?.mentions ?? []) picked.current.set(mention.userId, mention.name);
    setText(editing?.body ?? "");
  }, [editing?.id]);

  // Opening Reply or Edit puts the caret in the box, so the keyboard comes up ready to type.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the target message changes
  useEffect(() => {
    if (editing || replyTo) input.current?.focus();
  }, [editing?.id, replyTo?.id]);

  const query: MentionQuery | null = mentionQuery(text, caret);
  const suggestions = query ? suggestMembers(members, query.query, selfId) : [];
  const suggesting = suggestions.length > 0;
  const activeOption = suggestions[Math.min(active, suggestions.length - 1)];

  const choose = (member: MemberSummary) => {
    if (!query) return;
    const next = insertMention(text, caret, query, member.username);
    picked.current.set(member.userId, member.username);
    setText(next.text);
    setCaret(next.caret);
    setActive(0);
    // The value updates on the next render; move the caret once it has.
    window.requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const finish = () => {
    setText("");
    picked.current.clear();
    onDone();
  };

  // Dropping a reply keeps the draft; dropping an edit discards the half-edited text.
  const cancel = editing ? finish : onDone;

  const send = (gifUrl?: string) => {
    if (pending || (!body && !gifUrl)) return;
    const mentionedUserIds = stillMentioned(body, picked.current);
    if (editing) {
      edit.mutate({ messageId: editing.id, body, mentionedUserIds }, { onSuccess: finish });
      return;
    }
    // The message is on screen already: clear the box now and put the text back if it fails.
    const sent = { text, picked: new Map(picked.current) };
    finish();
    post.mutate(
      { body, gifUrl, replyToId: replyTo?.id, mentionedUserIds },
      {
        onError: () => {
          if (!gifUrl) {
            setText(sent.text);
            for (const [id, name] of sent.picked) picked.current.set(id, name);
          }
          setFailed(true);
        },
      },
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setCaret(event.target.selectionStart ?? event.target.value.length);
    setActive(0);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (suggesting) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : suggestions.length - 1;
        setActive((current) => (current + step) % suggestions.length);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && !event.nativeEvent.isComposing) {
        event.preventDefault();
        if (activeOption) choose(activeOption);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCaret(0);
        return;
      }
    } else if (event.key === "Escape" && (editing || replyTo)) {
      event.preventDefault();
      cancel();
      return;
    }
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      finePointer()
    ) {
      event.preventDefault();
      send();
    }
  };

  const error = editing ? mutationError(edit.error, "Couldn't save your edit. Try again.") : null;
  const context = editing
    ? "Editing your message"
    : replyTo
      ? `Replying to ${quoteLabel(replyTo)}`
      : null;

  return (
    <Box
      sx={{
        borderTop: `1px solid ${tokens.border}`,
        bgcolor: tokens.bg,
        px: 2,
        py: 1.25,
        position: "relative",
      }}
    >
      {suggesting && (
        <Box
          role="listbox"
          aria-label="Mention a member"
          sx={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: "100%",
            bgcolor: tokens.surfaceRaised,
            border: `1px solid ${tokens.borderStrong}`,
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {suggestions.map((member, index) => (
            <Box
              key={member.userId}
              role="option"
              id={`mention-option-${member.userId}`}
              aria-selected={index === active}
              // Pressing keeps the text box focused so the keyboard stays up.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(member)}
              sx={{
                minHeight: 44,
                px: 1.5,
                display: "flex",
                alignItems: "center",
                fontSize: 14,
                cursor: "pointer",
                bgcolor: index === active ? tokens.accentSurface : "transparent",
              }}
            >
              @{member.username}
            </Box>
          ))}
        </Box>
      )}
      {context && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${tokens.accentBorder}`, pl: 1 }}
          >
            {context}
          </Typography>
          <IconButton
            aria-label={editing ? "Cancel editing" : "Cancel reply"}
            onClick={cancel}
            sx={{ width: 44, height: 44, flex: "none" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <Box
        component="form"
        onSubmit={submit}
        sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}
      >
        {provider && !editing && (
          <IconButton
            aria-label="Add a GIF"
            onClick={() => setPicking(true)}
            disabled={pending}
            sx={roundButtonSx}
          >
            GIF
          </IconButton>
        )}
        <InputBase
          multiline
          maxRows={4}
          value={text}
          onChange={onChange}
          onSelect={(event) => setCaret((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          inputRef={input}
          placeholder="Message the league"
          inputProps={{
            "aria-label": "Message the league",
            maxLength: MAX_MESSAGE_LENGTH,
            role: "combobox",
            "aria-expanded": suggesting,
            "aria-autocomplete": "list",
            "aria-activedescendant": activeOption
              ? `mention-option-${activeOption.userId}`
              : undefined,
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            px: 2,
            py: 0.75,
            fontSize: 14,
            borderRadius: "22px",
            border: `1px solid ${tokens.borderStrong}`,
            bgcolor: tokens.surface,
            alignItems: "center",
          }}
        />
        <IconButton
          type="submit"
          aria-label={editing ? "Save edit" : "Send message"}
          disabled={pending || !body}
          sx={{
            ...roundButtonSx,
            bgcolor: tokens.accentFill,
            borderColor: tokens.accentFill,
            color: tokens.accentInk,
            "&:hover": { bgcolor: tokens.accentFill },
            "&.Mui-disabled": {
              bgcolor: tokens.surfaceRaised,
              borderColor: tokens.borderStrong,
              color: tokens.muted,
            },
          }}
        >
          {editing ? <CheckIcon fontSize="small" /> : <ArrowForwardIcon fontSize="small" />}
        </IconButton>
      </Box>
      {text.length > MAX_MESSAGE_LENGTH - 200 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {text.length} / {MAX_MESSAGE_LENGTH}
        </Typography>
      )}
      <AppToast
        open={failed}
        severity="error"
        message="Couldn't send your message. It's back in the box, try again."
        onClose={() => setFailed(false)}
      />
      {picking && provider && (
        <GifPicker
          provider={provider}
          onClose={() => setPicking(false)}
          onPick={(gif) => {
            setPicking(false);
            send(gif.url);
          }}
        />
      )}
    </Box>
  );
};

export default Composer;
