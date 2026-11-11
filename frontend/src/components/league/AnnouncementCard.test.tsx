import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueInfo } from "../../api/types";
import AnnouncementCard from "./AnnouncementCard";

const mocks = vi.hoisted(() => ({ pin: vi.fn(), unpin: vi.fn() }));
vi.mock("../../api/queries", () => ({
  usePinAnnouncement: () => ({ mutate: mocks.pin, isPending: false, error: null }),
  useUnpinAnnouncement: () => ({ mutate: mocks.unpin, isPending: false, error: null }),
}));

const league = (over: Partial<LeagueInfo> = {}): LeagueInfo =>
  ({
    id: 7,
    name: "Family",
    notes: "",
    myRole: "member",
    announcement: null,
    ...over,
  }) as LeagueInfo;
const pinned = {
  body: "Draft is Saturday",
  postedAt: "2027-01-02T15:00:00Z",
  authorName: "Dave",
};

beforeEach(() => {
  mocks.pin.mockClear();
  mocks.unpin.mockClear();
});

describe("AnnouncementCard", () => {
  it("shows a member the pinned text and no controls", () => {
    render(<AnnouncementCard league={league({ announcement: pinned })} />);
    expect(screen.getByText("Draft is Saturday")).toBeInTheDocument();
    expect(screen.getByText(/Dave/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a member nothing when there is no announcement", () => {
    const { container } = render(<AnnouncementCard league={league()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lets a commissioner post one, choosing whether it also pushes", () => {
    render(<AnnouncementCard league={league({ myRole: "commissioner" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Post an announcement" }));
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /^Announcement/ }), {
      target: { value: "  Hi all  " },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Also send it as a notification" }));
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(mocks.pin).toHaveBeenCalledWith({ body: "Hi all", push: true }, expect.anything());
  });

  it("lets a commissioner edit it and asks before removing it", () => {
    render(<AnnouncementCard league={league({ myRole: "commissioner", announcement: pinned })} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.unpin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(mocks.unpin).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: /^Announcement/ })).toHaveValue("Draft is Saturday");
  });
});
