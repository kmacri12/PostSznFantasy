import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SeasonOverview } from "../api/types";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import MorePage from "./MorePage";

const mocks = vi.hoisted(() => ({
  bracket: true,
  seasons: [
    { id: 4, year: 2025, finished: true, draftStatus: "completed", current: false },
    { id: 9, year: 2026, finished: false, draftStatus: "scheduled", current: true },
  ],
}));

vi.mock("../api/queries", () => ({
  useUserLeagues: () => ({ data: [{ id: 3, seasons: mocks.seasons }] }),
  useInvite: () => ({ data: undefined, isError: false }),
  useRegenerateInvite: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeInvite: () => ({ mutate: vi.fn(), isPending: false }),
  useReportProblem: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useApiVersion: () => ({ data: null }),
  useFeatures: () => ({ bracket: mocks.bracket }),
}));
vi.mock("../contexts/UserContext", () => ({ useUser: () => ({ signOutUser: vi.fn() }) }));

const renderMore = (season: Partial<SeasonOverview> = {}) =>
  render(
    <MemoryRouter>
      <SeasonContext.Provider value={testSeason(season, true)}>
        <MorePage />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );

describe("MorePage", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("hides the support row when VITE_SUPPORT_URL is unset", () => {
    vi.stubEnv("VITE_SUPPORT_URL", "");
    renderMore();
    expect(screen.queryByText("Support PostSzn")).toBeNull();
  });

  it("opens the support page in a new tab, safely, when VITE_SUPPORT_URL is set", () => {
    vi.stubEnv("VITE_SUPPORT_URL", "https://buymeacoffee.com/kmacri12");
    renderMore();
    const link = screen.getByRole("link", { name: /Support PostSzn/ });
    expect(link).toHaveAttribute("href", "https://buymeacoffee.com/kmacri12");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("changes nothing in your league");
  });

  it("lists the league rows with the draft status under Players", () => {
    renderMore({ draftStatus: "unscheduled" });
    expect(screen.queryByRole("link", { name: /Settings/ })).toBeNull();
    expect(screen.getByText("Draft not scheduled")).toBeInTheDocument();
    expect(screen.getByText("How to play")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Draft board" })).toHaveAttribute(
      "href",
      "/leagues/3/draft/board",
    );
  });

  it("links to the NFL bracket unless the owner turned it off", () => {
    mocks.bracket = true;
    const { unmount } = renderMore();
    expect(screen.getByRole("link", { name: /NFL bracket/ })).toHaveAttribute(
      "href",
      "/leagues/3/bracket",
    );
    unmount();
    mocks.bracket = false;
    renderMore();
    expect(screen.queryByRole("link", { name: /NFL bracket/ })).toBeNull();
    mocks.bracket = true;
  });

  it("opens the problem report from the Help group, for every member", () => {
    renderMore({ isFormerMember: true });
    fireEvent.click(screen.getByRole("button", { name: /Report a problem/ }));
    expect(screen.getByRole("textbox", { name: /What went wrong/ })).toBeInTheDocument();
  });

  it("opens the feedback form from the Help group", () => {
    renderMore();
    fireEvent.click(screen.getByRole("button", { name: /Send feedback/ }));
    expect(screen.getByRole("textbox", { name: "What was good?" })).toBeInTheDocument();
  });

  it("offers Past seasons only when the league has any, and opens them in a sheet", () => {
    renderMore();
    fireEvent.click(screen.getByRole("button", { name: /Past seasons/ }));
    expect(screen.getByRole("link", { name: /2025 season/ })).toHaveAttribute(
      "href",
      "/leagues/3/seasons/2025",
    );
  });

  it("hides Past seasons for a league with a single season", () => {
    mocks.seasons = [
      { id: 9, year: 2026, finished: false, draftStatus: "scheduled", current: true },
    ];
    renderMore();
    expect(screen.queryByText("Past seasons")).not.toBeInTheDocument();
  });

  it("shows Invite members to commissioners only", () => {
    renderMore({ canCommission: false });
    expect(screen.queryByText("Invite members")).not.toBeInTheDocument();
  });

  it("opens the invite sheet for a commissioner", () => {
    renderMore({ canCommission: true });
    fireEvent.click(screen.getByRole("button", { name: /Invite members/ }));
    expect(screen.getByText("Invite link")).toBeInTheDocument();
  });
});
