import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueInfo, MemberSummary } from "../api/types";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import SettingsPage from "./SettingsPage";

const member = (userId: number, username: string, role: MemberSummary["role"]): MemberSummary => ({
  userId,
  username,
  role,
  teamId: userId,
  teamName: `${username}'s team`,
});

const mocks = vi.hoisted(() => ({
  info: undefined as LeagueInfo | undefined,
  // Stable: the page re-seeds its form state whenever this object changes identity.
  settings: {},
}));

const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null };

vi.mock("../api/queries", () => ({
  useLeagueInfo: () => ({ data: mocks.info }),
  useLeagueSettings: () => ({ isLoading: false, isError: false, data: mocks.settings }),
  useDraft: () => ({ data: { status: "unscheduled" } }),
  useInvite: () => ({ data: { revoked: false } }),
  useSetAvatar: () => ({ ...mutation, reset: vi.fn() }),
  useUpdateLeague: () => mutation,
  useUpdateSeason: () => mutation,
  useUpdateSettings: () => mutation,
  useSetMemberRole: () => mutation,
  useRemoveMember: () => mutation,
}));
vi.mock("../contexts/UserContext", () => ({ useUser: () => ({ userId: 2 }) }));
vi.mock("../components/settings/RosterForm", () => ({ default: () => null }));
vi.mock("../components/settings/ScoringForm", () => ({ default: () => null }));
vi.mock("../components/settings/PostseasonForm", () => ({ default: () => null }));

const info = (myRole: LeagueInfo["myRole"]): LeagueInfo => ({
  id: 3,
  name: "Sunday League",
  notes: "House rules: no trading.",
  myRole,
  currentSeasonId: 5,
  canStartSeason: false,
  nextYear: 2026,
  seasons: [],
  members: [member(1, "Kyle", "commissioner"), member(2, "Dave", "member")],
});

const renderPage = (role: LeagueInfo["myRole"]) => {
  mocks.info = info(role);
  return render(
    <MemoryRouter>
      <SeasonContext.Provider
        value={testSeason({ canCommission: role === "commissioner", myRole: role })}
      >
        <SettingsPage />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("League settings", () => {
  it("shows a commissioner every row as editable, plus invite and delete", () => {
    renderPage("commissioner");
    expect(screen.getByRole("heading", { name: "League settings" })).toBeInTheDocument();
    for (const name of [
      /^Edit league name/,
      /^Edit league note/,
      /^Edit members/,
      /^Invite link/,
      /^Delete league/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Scoring" })).toBeInTheDocument();
  });

  it("lets a commissioner, and only a commissioner, change the league picture", () => {
    renderPage("commissioner");
    expect(screen.getByRole("button", { name: /^League picture/ })).toBeInTheDocument();
  });

  it("shows a member the same information with nothing to change", () => {
    renderPage("member");
    expect(screen.getByText("League picture")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^League picture/ })).toBeNull();
    expect(screen.getByText("Sunday League")).toBeInTheDocument();
    expect(screen.getByText("House rules: no trading.")).toBeInTheDocument();
    expect(screen.getByText("3 teams")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit league/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Invite link/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete league/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Number of teams/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Roster" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scoring" })).toBeInTheDocument();
  });

  it("lets a member look at the members, without role switches or removal", () => {
    renderPage("member");
    fireEvent.click(screen.getByRole("button", { name: /^Members/ }));
    const sheet = screen.getByRole("dialog", { name: "Members" });
    expect(within(sheet).getByText("Kyle")).toBeInTheDocument();
    expect(within(sheet).getByText("Commissioner")).toBeInTheDocument();
    expect(within(sheet).queryByRole("switch")).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Remove from league" })).toBeNull();
  });

  it("gives a commissioner the role switches in the members sheet", () => {
    renderPage("commissioner");
    fireEvent.click(screen.getByRole("button", { name: /^Edit members/ }));
    const sheet = screen.getByRole("dialog", { name: "Edit members" });
    expect(within(sheet).getAllByRole("switch")).toHaveLength(2);
  });

  it("no longer holds the profile: no display name, theme, notifications or sign out", () => {
    renderPage("commissioner");
    for (const text of [/Display name/, /Theme/, /Notifications/, /Sign out/, /Your settings/]) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });
});
