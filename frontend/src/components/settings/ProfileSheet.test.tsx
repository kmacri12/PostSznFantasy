import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileSheet from "./ProfileSheet";

const mocks = vi.hoisted(() => ({ updateDisplayName: vi.fn() }));

vi.mock("../../contexts/UserContext", () => ({
  useUser: () => ({
    username: "Kyle",
    updateDisplayName: mocks.updateDisplayName,
    avatarUrl: null,
    setAvatarUrl: vi.fn(),
  }),
}));
vi.mock("../../api/queries", () => ({
  useSetAvatar: () => ({ mutateAsync: vi.fn(), reset: vi.fn(), error: null }),
  useDeleteAccount: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock("./ThemeModeRow", () => ({ default: () => <div>Theme row</div> }));
vi.mock("./NotificationsToggle", () => ({ default: () => <div>Notifications row</div> }));

const user = { id: "u", email: "kyle@example.com", user_metadata: { full_name: "Kyle" } } as never;

beforeEach(() => {
  mocks.updateDisplayName.mockReset();
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("ProfileSheet", () => {
  it("holds display name, theme, notifications and sign out, and nothing about a league", () => {
    render(<ProfileSheet user={user} onSignOut={vi.fn()} onClose={vi.fn()} />);
    const sheet = screen.getByRole("dialog", { name: "Profile settings" });
    expect(sheet).toHaveTextContent("Profile picture");
    expect(sheet).toHaveTextContent("Display name");
    expect(sheet).toHaveTextContent("Kyle");
    expect(sheet).toHaveTextContent("kyle@example.com");
    expect(sheet).toHaveTextContent("Theme row");
    expect(sheet).toHaveTextContent("Notifications row");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(sheet).not.toHaveTextContent(/team name|league/i);
  });

  it("renames the user and shows the new name when the edit closes", async () => {
    mocks.updateDisplayName.mockResolvedValue(null);
    render(<ProfileSheet user={user} onSignOut={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Display name/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Display name" }), {
      target: { value: "Ky" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updateDisplayName).toHaveBeenCalledWith("Ky"));
    expect(await screen.findByRole("dialog", { name: "Profile settings" })).toHaveTextContent("Ky");
  });

  it("opens the delete-account confirmation from its own row", () => {
    render(<ProfileSheet user={user} onSignOut={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(screen.getByText("This is permanent and cannot be undone.")).toBeInTheDocument();
  });

  it("puts Delete my account under a Danger zone heading, after Sign out", () => {
    render(<ProfileSheet user={user} onSignOut={vi.fn()} onClose={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: "Danger zone" });
    const signOut = screen.getByRole("button", { name: "Sign out" });
    const remove = screen.getByRole("button", { name: "Delete my account" });
    expect(
      signOut.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(heading.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("closes the sheet, then signs out", () => {
    const calls: string[] = [];
    render(
      <ProfileSheet
        user={user}
        onSignOut={() => calls.push("signOut")}
        onClose={() => calls.push("close")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(calls).toEqual(["close", "signOut"]);
  });
});
