import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  health: "up" as "checking" | "up" | "down",
  dormant: false,
  syncError: null as string | null,
  retrySync: vi.fn(),
  user: null as unknown,
  userId: null as number | null,
}));

vi.mock("./api/health", () => ({
  useApiHealth: () => mocks.health,
  isDormant: () => mocks.dormant,
}));
vi.mock("./api/queries", () => ({
  useUserLeagues: () => ({ data: [] }),
  useRenameTeam: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));
vi.mock("./contexts/UserContext", () => ({
  useUser: () => ({
    user: mocks.user,
    userId: mocks.userId,
    syncError: mocks.syncError,
    retrySync: mocks.retrySync,
    signIn: vi.fn(),
    signOutUser: vi.fn(),
  }),
  useUserAvatar: () => null,
  useUsername: () => null,
}));
vi.mock("./components/auth/SessionExpiredBanner", () => ({ default: () => null }));
vi.mock("./components/dev/DevQuickSync", () => ({ DevQuickSync: () => null }));
vi.mock("./pages/NotFoundPage", () => ({ default: () => <div>not found page</div> }));
vi.mock("./pages/LeaguePage", () => ({ default: () => <div>league page</div> }));

const queryClient = new QueryClient();
const tree = (url: string) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>
  </QueryClientProvider>
);
const renderAt = (url: string) => render(tree(url));

beforeEach(() => {
  mocks.health = "up";
  mocks.dormant = false;
  mocks.syncError = null;
  mocks.user = null;
  mocks.userId = null;
  mocks.retrySync.mockClear();
  vi.restoreAllMocks();
});

describe("API up", () => {
  it("shows the signed-out landing page with its sign-in call to action", async () => {
    renderAt("/");
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeVisible();
    expect(screen.queryByText(/back for the next postseason/i)).not.toBeInTheDocument();
  });

  it("has no global players page any more", async () => {
    renderAt("/players");
    expect(await screen.findByText("not found page")).toBeVisible();
  });
});

describe("dormant mode (VITE_DORMANT)", () => {
  beforeEach(() => {
    mocks.dormant = true;
  });

  it("shows the off-season notice on the landing page with the legal links", async () => {
    renderAt("/");
    expect(await screen.findByText(/back for the next postseason/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("keeps How to play readable", async () => {
    renderAt("/how-to-play");
    expect(await screen.findByRole("heading", { level: 1 })).toBeVisible();
    expect(screen.queryByText(/back for the next postseason/i)).not.toBeInTheDocument();
  });

  it("replaces broken screens with the notice and a way to the marketing page", async () => {
    renderAt("/players");
    expect(await screen.findByText(/back for the next postseason/i)).toBeVisible();
    expect(screen.queryByText("players page")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See how it works" })).toBeVisible();
  });
});

describe("API outage", () => {
  beforeEach(() => {
    mocks.health = "down";
  });

  it("keeps the page and shows a reconnecting banner instead of the off-season notice", async () => {
    renderAt("/");
    expect(await screen.findByText("Reconnecting to PostSzn...")).toBeVisible();
    expect(screen.queryByText(/back for the next postseason/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  it("refetches and retries a failed sign-in sync when the API comes back, without a reload", async () => {
    mocks.syncError = "Couldn't reach the server";
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const view = renderAt("/");
    await screen.findByText("Reconnecting to PostSzn...");
    expect(invalidate).not.toHaveBeenCalled();
    mocks.health = "up";
    view.rerender(tree("/"));
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(mocks.retrySync).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Reconnecting to PostSzn...")).not.toBeInTheDocument();
  });
});

describe("while the health check is pending", () => {
  it("renders the normal app rather than flashing the notice", async () => {
    mocks.health = "checking";
    renderAt("/");
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeVisible();
    expect(screen.queryByText(/back for the next postseason/i)).not.toBeInTheDocument();
  });
});
