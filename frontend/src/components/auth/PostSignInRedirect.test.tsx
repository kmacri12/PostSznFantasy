import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PostSignInRedirect from "./PostSignInRedirect";

const mocks = vi.hoisted(() => ({
  user: { userId: 7 as number | null, syncError: null as string | null },
  leagues: { data: undefined as unknown[] | undefined, isError: false },
}));

vi.mock("../../contexts/UserContext", () => ({ useUser: () => mocks.user }));
vi.mock("../../api/queries", () => ({
  useUserLeagues: () => ({ ...mocks.leagues, error: null, refetch: vi.fn() }),
}));

const renderRedirect = (next: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/sign-in"]}>
        <Routes>
          <Route path="/sign-in" element={<PostSignInRedirect next={next} />} />
          <Route path="/" element={<div>home</div>} />
          <Route path="/leagues/:id" element={<div>league</div>} />
          <Route path="/join/:code" element={<div>join</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  mocks.user = { userId: 7, syncError: null };
  mocks.leagues = { data: [], isError: false };
});

describe("PostSignInRedirect", () => {
  it("sends a user with no leagues to the leagues page", () => {
    renderRedirect("/");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("sends a user with exactly one league straight into it", () => {
    mocks.leagues = { data: [{ id: 1 }], isError: false };
    renderRedirect("/");
    expect(screen.getByText("league")).toBeInTheDocument();
  });

  it("sends a user with several leagues to the leagues page", () => {
    mocks.leagues = { data: [{ id: 1 }, { id: 2 }], isError: false };
    renderRedirect("/");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("honours an explicit destination even for a user with no leagues", () => {
    renderRedirect("/join/ABC");
    expect(screen.getByText("join")).toBeInTheDocument();
  });

  it("waits for the leagues before deciding", () => {
    mocks.leagues = { data: undefined, isError: false };
    renderRedirect("/");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the sync failure instead of spinning forever", () => {
    mocks.user = { userId: null, syncError: "Couldn't reach the server" };
    renderRedirect("/");
    expect(screen.getByText(/couldn.t reach the server/i)).toBeInTheDocument();
  });
});
