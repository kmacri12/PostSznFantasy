import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  health: "up" as "checking" | "up" | "down",
  user: null as unknown,
  userId: null as number | null,
}));

vi.mock("./api/health", () => ({ useApiHealth: () => mocks.health }));
vi.mock("./api/queries", () => ({ useUserLeagues: () => ({ data: [] }) }));
vi.mock("./contexts/UserContext", () => ({
  useUser: () => ({
    user: mocks.user,
    userId: mocks.userId,
    signIn: vi.fn(),
    signOutUser: vi.fn(),
  }),
}));
vi.mock("./components/auth/SessionExpiredBanner", () => ({ default: () => null }));
vi.mock("./components/dev/DevQuickSync", () => ({ DevQuickSync: () => null }));
vi.mock("./pages/PlayersPage", () => ({ default: () => <div>players page</div> }));
vi.mock("./pages/LeaguePage", () => ({ default: () => <div>league page</div> }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.health = "up";
  mocks.user = null;
  mocks.userId = null;
});

describe("API up", () => {
  it("shows the signed-out landing page with its sign-in call to action", async () => {
    renderAt("/");
    expect(await screen.findByRole("button", { name: "Sign in to play" })).toBeVisible();
    expect(screen.queryByText(/back for the next postseason/i)).not.toBeInTheDocument();
  });

  it("renders app routes normally", async () => {
    renderAt("/players");
    expect(await screen.findByText("players page")).toBeVisible();
  });
});

describe("API down (dormant mode)", () => {
  beforeEach(() => {
    mocks.health = "down";
  });

  it("shows the off-season notice on the landing page and keeps the marketing content", async () => {
    renderAt("/");
    expect(await screen.findByText(/back for the next postseason/i)).toBeVisible();
    expect(screen.getByText("How it works")).toBeVisible();
    expect(screen.getByText("Playoff rules you control")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sign in to play" })).not.toBeInTheDocument();
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

describe("while the health check is pending", () => {
  it("renders the normal app rather than flashing the notice", async () => {
    mocks.health = "checking";
    renderAt("/");
    expect(await screen.findByRole("button", { name: "Sign in to play" })).toBeVisible();
    expect(screen.queryByText(/back for the next postseason/i)).not.toBeInTheDocument();
  });
});
