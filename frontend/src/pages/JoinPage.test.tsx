import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinPage from "./JoinPage";

const mocks = vi.hoisted(() => ({
  user: { user: null as unknown, userId: null as number | null, loading: false },
  signIn: vi.fn(),
  joinMutate: vi.fn(),
}));

vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({ ...mocks.user, signIn: mocks.signIn, syncError: null }),
}));
vi.mock("../api/queries", () => ({
  useInvitePreview: () => ({
    isLoading: false,
    isError: false,
    data: { leagueName: "Gridiron", season: 2026, openSpots: 2, joinable: true, reason: null },
  }),
  useJoinWithCode: () => ({ mutate: mocks.joinMutate, isPending: false, isError: false }),
}));

const renderJoin = () =>
  render(
    <MemoryRouter initialEntries={["/join/ABC123"]}>
      <Routes>
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/league/:id" element={<div>league page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.user = { user: null, userId: null, loading: false };
  mocks.signIn.mockReset();
  mocks.joinMutate.mockReset();
});

describe("JoinPage when signed out", () => {
  it("shows the league and asks to sign in without joining", () => {
    renderJoin();
    expect(screen.getByText("Gridiron")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sign in to join/i }));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.joinMutate).not.toHaveBeenCalled();
  });

  it("joins automatically once the sign-in returns here", async () => {
    mocks.user = { user: { id: "u1" }, userId: 5, loading: false };
    mocks.joinMutate.mockImplementation((_code, options) =>
      options.onSuccess({ leagueId: 90, seasonId: 9 }),
    );
    renderJoin();

    await waitFor(() => expect(screen.getByText("league page")).toBeInTheDocument());
    expect(mocks.joinMutate).toHaveBeenCalledWith("ABC123", expect.anything());
  });
});
