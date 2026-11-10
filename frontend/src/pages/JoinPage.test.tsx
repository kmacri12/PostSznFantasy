import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitePreview } from "../api/types";
import JoinPage from "./JoinPage";

const mocks = vi.hoisted(() => ({
  user: { user: null as unknown, userId: null as number | null, loading: false },
  preview: {} as unknown,
  refetch: vi.fn(),
  joinMutate: vi.fn(),
  joinError: null as unknown,
}));

vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({ ...mocks.user, syncError: null }),
}));
vi.mock("../api/queries", () => ({
  useInvitePreview: () => ({
    isLoading: false,
    isError: false,
    data: mocks.preview,
    refetch: mocks.refetch,
  }),
  useJoinWithCode: () => ({
    mutate: mocks.joinMutate,
    isPending: false,
    isError: mocks.joinError !== null,
    error: mocks.joinError,
  }),
}));

const preview = (overrides: Partial<InvitePreview> = {}): InvitePreview => ({
  code: "ABC123",
  leagueName: "Gridiron",
  season: 2026,
  openSpots: 2,
  full: false,
  members: [
    { displayName: "Kyle", isCommissioner: true },
    { displayName: "Dave", isCommissioner: false },
  ],
  joinable: true,
  reason: null,
  ...overrides,
});

const renderJoin = () =>
  render(
    <MemoryRouter initialEntries={["/join/ABC123"]}>
      <Routes>
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/leagues/:id" element={<div>league page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.user = { user: null, userId: null, loading: false };
  mocks.preview = preview();
  mocks.joinMutate.mockReset();
  mocks.refetch.mockReset();
  mocks.joinError = null;
});

describe("JoinPage preview", () => {
  it("shows the league, commissioner, every member and the open slots", () => {
    renderJoin();
    expect(screen.getByRole("heading", { name: "Gridiron" })).toBeTruthy();
    expect(screen.getByText(/Kyle is the commissioner/)).toBeTruthy();
    expect(screen.getByText("Dave")).toBeTruthy();
    expect(screen.getAllByText("Open slot")).toHaveLength(2);
    expect(screen.getByText("2 of 4 teams filled")).toBeTruthy();
  });
});

describe("JoinPage when signed out", () => {
  it("sends the visitor to sign in and back here without joining", () => {
    renderJoin();
    expect(screen.getByRole("link", { name: "Sign in to join" }).getAttribute("href")).toBe(
      "/sign-in?next=%2Fjoin%2FABC123",
    );
    expect(mocks.joinMutate).not.toHaveBeenCalled();
  });
});

describe("JoinPage when signed in", () => {
  beforeEach(() => {
    mocks.user = { user: { id: "u1", email: "me@e2e.test" }, userId: 5, loading: false };
  });

  it("joins only when the button is pressed, then opens the league", async () => {
    mocks.joinMutate.mockImplementation((_code, options) =>
      options.onSuccess({ leagueId: 90, seasonId: 9 }),
    );
    renderJoin();
    expect(mocks.joinMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Signed in as me@e2e.test")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join league" }));
    await waitFor(() => expect(screen.getByText("league page")).toBeTruthy());
    expect(mocks.joinMutate).toHaveBeenCalledWith("ABC123", expect.anything());
  });

  it("disables joining a full league and tells the visitor to ask the commissioner", () => {
    mocks.preview = preview({
      full: true,
      openSpots: 0,
      joinable: false,
      reason: "This league is full",
    });
    renderJoin();
    expect(screen.getByText("This league is full")).toBeTruthy();
    expect(screen.getByText(/Ask your commissioner/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Join league" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("switches to the full state when the league fills while the page is open", () => {
    mocks.joinMutate.mockImplementation((_code, options) =>
      options.onError({ response: { status: 409, data: { code: "league_full" } } }),
    );
    renderJoin();
    fireEvent.click(screen.getByRole("button", { name: "Join league" }));
    expect(screen.getByText(/Ask your commissioner/)).toBeTruthy();
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("explains an invite that can't be used", () => {
    mocks.preview = preview({
      joinable: false,
      reason: "This invite has been revoked. Ask your commissioner for a new link",
    });
    renderJoin();
    expect(
      screen.getByText("This invite has been revoked. Ask your commissioner for a new link"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Join league" })).toBeNull();
  });
});
