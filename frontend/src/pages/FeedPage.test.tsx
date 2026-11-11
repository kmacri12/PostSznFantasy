import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feed, FeedItem, FeedMessageItem, MemberSummary } from "../api/types";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import FeedPage from "./FeedPage";

const useFeed = vi.fn();
const post = vi.fn();
const edit = vi.fn();
const react = vi.fn();
const markViewed = vi.fn();
vi.mock("../api/queries", () => ({
  useFeed: (...args: unknown[]) => useFeed(...args),
  useMarkFeedViewed: () => ({ mutate: markViewed, isPending: false }),
  usePostMessage: () => ({ mutate: post, isPending: false, error: null }),
  useEditMessage: () => ({ mutate: edit, isPending: false, error: null }),
  useReactToMessage: () => ({ mutate: react }),
  useDeleteMessage: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  usePushPreferences: () => ({ data: { mutedLeagueIds: [] } }),
  useMuteLeagueChat: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../hooks/useFeedLive", () => ({ useFeedLive: () => ({ isConnected: true }) }));
vi.mock("../contexts/UserContext", () => ({ useUser: () => ({ userId: 3 }) }));

const message = (
  id: number,
  authorUserId: number,
  canDelete: boolean,
  isNew = false,
  extra: Partial<FeedMessageItem> = {},
): FeedItem => ({
  type: "message",
  id,
  createdAt: "2030-01-11T19:00:00Z",
  authorUserId,
  authorName: authorUserId === 3 ? "Kyle" : "Dave",
  body: `message ${id}`,
  gifUrl: null,
  canDelete,
  canEdit: false,
  editedAt: null,
  isNew,
  replyTo: null,
  mentions: [],
  reactions: [],
  ...extra,
});

const feedOf = (items: FeedItem[], extra: Partial<Feed> = {}) => ({
  data: { pages: [{ items, nextBefore: null, hasNew: false, canPost: true, ...extra }] },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
});

const member = (userId: number, username: string): MemberSummary => ({
  userId,
  username,
  role: "member",
  teamId: null,
  teamName: null,
});

const renderPage = () =>
  render(
    <SeasonContext.Provider
      value={testSeason(
        { members: [member(3, "Kyle"), member(4, "Dave"), member(5, "Pat")] },
        true,
      )}
    >
      <FeedPage />
    </SeasonContext.Provider>,
  );

beforeEach(() => {
  window.scrollTo = vi.fn();
  useFeed.mockReset();
  post.mockReset();
  edit.mockReset();
  react.mockReset();
  markViewed.mockReset();
});

describe("FeedPage", () => {
  it("shows own messages as You and no always-visible delete button", () => {
    useFeed.mockReturnValue(feedOf([message(2, 4, false), message(1, 3, true)]));
    renderPage();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Dave")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete message/ })).not.toBeInTheDocument();
  });

  describe("the message menu", () => {
    const bubble = (name: RegExp) => screen.getByRole("group", { name });

    it("opens on right-click with reactions and reply, and no delete or edit on others' messages", () => {
      useFeed.mockReturnValue(feedOf([message(2, 4, false)]));
      renderPage();
      fireEvent.contextMenu(bubble(/Message from Dave/));
      expect(screen.getByRole("toolbar", { name: "React to this message" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add reaction" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Reply" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Delete message/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("offers delete and edit on your own message", () => {
      useFeed.mockReturnValue(
        feedOf([
          message(1, 3, true, false, { canEdit: true, createdAt: new Date().toISOString() }),
        ]),
      );
      renderPage();
      fireEvent.contextMenu(bubble(/Message from You/));
      expect(screen.getByRole("button", { name: "Delete message from You" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    });

    it("stops offering edit once the five minutes are over", () => {
      useFeed.mockReturnValue(
        feedOf([message(1, 3, true, false, { canEdit: true, createdAt: "2020-01-11T19:00:00Z" })]),
      );
      renderPage();
      fireEvent.contextMenu(bubble(/Message from You/));
      expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("opens from the keyboard: Enter on the focused message", () => {
      useFeed.mockReturnValue(feedOf([message(2, 4, false)]));
      renderPage();
      fireEvent.keyDown(bubble(/Message from Dave/), { key: "Enter" });
      expect(screen.getByRole("menuitem", { name: "Reply" })).toBeInTheDocument();
    });

    it("opens from the more button", () => {
      useFeed.mockReturnValue(feedOf([message(2, 4, false)]));
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Message actions from Dave" }));
      expect(screen.getByRole("menuitem", { name: "Reply" })).toBeInTheDocument();
    });

    it("opens on a long press, but not when the finger scrolls", () => {
      vi.useFakeTimers();
      try {
        useFeed.mockReturnValue(feedOf([message(2, 4, false)]));
        renderPage();
        const target = bubble(/Message from Dave/);
        fireEvent.touchStart(target, { touches: [{ clientX: 5, clientY: 5 }] });
        fireEvent.touchMove(target, { touches: [{ clientX: 5, clientY: 80 }] });
        act(() => vi.advanceTimersByTime(600));
        expect(screen.queryByRole("menuitem", { name: "Reply" })).not.toBeInTheDocument();
        fireEvent.touchEnd(target);
        fireEvent.touchStart(target, { touches: [{ clientX: 5, clientY: 5 }] });
        act(() => vi.advanceTimersByTime(600));
        expect(screen.getByRole("menuitem", { name: "Reply" })).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("reacts with a quick emoji, and tapping one you used removes it", () => {
      useFeed.mockReturnValue(
        feedOf([
          message(2, 4, false, false, {
            reactions: [{ emoji: "🔥", count: 1, mine: true, names: ["Kyle"] }],
          }),
        ]),
      );
      renderPage();
      fireEvent.contextMenu(bubble(/Message from Dave/));
      fireEvent.click(screen.getByRole("button", { name: "React with 👍" }));
      expect(react).toHaveBeenCalledWith({ messageId: 2, emoji: "👍", reacted: true });

      fireEvent.contextMenu(bubble(/Message from Dave/));
      fireEvent.click(screen.getByRole("button", { name: "React with 🔥" }));
      expect(react).toHaveBeenLastCalledWith({ messageId: 2, emoji: "🔥", reacted: false });
    });

    it("picks any emoji from the full picker", () => {
      useFeed.mockReturnValue(feedOf([message(2, 4, false)]));
      renderPage();
      fireEvent.contextMenu(bubble(/Message from Dave/));
      fireEvent.click(screen.getByRole("button", { name: "Add reaction" }));
      fireEvent.click(screen.getByRole("button", { name: "React with 🏈" }));
      expect(react).toHaveBeenCalledWith({ messageId: 2, emoji: "🏈", reacted: true });
    });

    it("toggles a reaction from its chip, which says who reacted", () => {
      useFeed.mockReturnValue(
        feedOf([
          message(2, 4, false, false, {
            reactions: [{ emoji: "🎉", count: 2, mine: false, names: ["Dave", "Pat"] }],
          }),
        ]),
      );
      renderPage();
      const chip = screen.getByRole("button", { name: /🎉 2, Dave, Pat/ });
      expect(chip).toHaveAttribute("title", "Dave, Pat");
      fireEvent.click(chip);
      expect(react).toHaveBeenCalledWith({ messageId: 2, emoji: "🎉", reacted: true });
    });

    it("asks before deleting, through the existing confirmation", () => {
      useFeed.mockReturnValue(feedOf([message(2, 4, true)]));
      renderPage();
      fireEvent.contextMenu(bubble(/Message from Dave/));
      fireEvent.click(screen.getByRole("button", { name: "Delete message from Dave" }));
      expect(screen.getByText("Delete this message?")).toBeInTheDocument();
    });

    it("replies with the quote above the box and sends the reply id", () => {
      useFeed.mockReturnValue(feedOf([message(2, 4, false, false, { body: "who drafts first?" })]));
      renderPage();
      fireEvent.contextMenu(bubble(/Message from Dave/));
      fireEvent.click(screen.getByRole("menuitem", { name: "Reply" }));
      expect(screen.getByText("Replying to Dave: who drafts first?")).toBeInTheDocument();
      fireEvent.change(screen.getByRole("combobox", { name: "Message the league" }), {
        target: { value: "me" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      expect(post).toHaveBeenCalledWith(
        { body: "me", gifUrl: undefined, replyToId: 2, mentionedUserIds: [] },
        expect.anything(),
      );
    });

    it("edits your own message in the box and saves it", () => {
      useFeed.mockReturnValue(
        feedOf([
          message(1, 3, true, false, { canEdit: true, createdAt: new Date().toISOString() }),
        ]),
      );
      renderPage();
      fireEvent.contextMenu(bubble(/Message from You/));
      fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
      const box = screen.getByRole("combobox", { name: "Message the league" });
      expect(box).toHaveValue("message 1");
      fireEvent.change(box, { target: { value: "message one" } });
      fireEvent.click(screen.getByRole("button", { name: "Save edit" }));
      expect(edit).toHaveBeenCalledWith(
        { messageId: 1, body: "message one", mentionedUserIds: [] },
        expect.anything(),
      );
      expect(post).not.toHaveBeenCalled();
    });

    it("gives an archived season no menu", () => {
      useFeed.mockReturnValue(feedOf([message(2, 4, false)], { canPost: false }));
      renderPage();
      fireEvent.contextMenu(screen.getByText("message 2"));
      expect(screen.queryByRole("menuitem", { name: "Reply" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Message actions from Dave" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows quotes, edited, tagged names and a deleted original", () => {
    useFeed.mockReturnValue(
      feedOf([
        message(3, 4, false, false, {
          body: "hey @Kyle",
          mentions: [{ userId: 3, name: "Kyle" }],
          editedAt: "2030-01-11T19:02:00Z",
          replyTo: { id: 1, authorName: "Pat", snippet: "first!", deleted: false },
        }),
        message(2, 4, false, false, {
          replyTo: { id: 9, authorName: null, snippet: "", deleted: true },
        }),
      ]),
    );
    renderPage();
    expect(screen.getByText("@Kyle").tagName).toBe("STRONG");
    expect(screen.getByText("edited")).toBeInTheDocument();
    expect(screen.getByText("first!")).toBeInTheDocument();
    expect(screen.getByText("The original message was deleted.")).toBeInTheDocument();
  });

  it("suggests members after an @ and sends the ones picked", () => {
    useFeed.mockReturnValue(feedOf([]));
    renderPage();
    const box = screen.getByRole("combobox", { name: "Message the league" }) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "hi @Da", selectionStart: 6 } });
    const list = screen.getByRole("listbox", { name: "Mention a member" });
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    fireEvent.click(within(list).getByRole("option", { name: "@Dave" }));
    expect(box).toHaveValue("hi @Dave ");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(post).toHaveBeenCalledWith(
      { body: "hi @Dave", gifUrl: undefined, replyToId: undefined, mentionedUserIds: [4] },
      expect.anything(),
    );
  });

  it("sends the typed message", () => {
    useFeed.mockReturnValue(feedOf([]));
    renderPage();
    fireEvent.change(screen.getByRole("combobox", { name: "Message the league" }), {
      target: { value: "  see you Saturday " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(post).toHaveBeenCalledWith(
      { body: "see you Saturday", gifUrl: undefined, replyToId: undefined, mentionedUserIds: [] },
      expect.anything(),
    );
  });

  it("replaces the message box with a read-only note in an archived season", () => {
    useFeed.mockReturnValue(feedOf([message(1, 4, false)], { canPost: false }));
    renderPage();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/archived, so the Feed is read-only/)).toBeInTheDocument();
  });

  it("marks the feed viewed up to the newest item and draws a New divider", () => {
    useFeed.mockReturnValue(
      feedOf([message(5, 4, false, true), message(4, 4, false)], { hasNew: true }),
    );
    renderPage();
    expect(markViewed).toHaveBeenCalledWith({ upToEventId: undefined, upToMessageId: 5 });
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
