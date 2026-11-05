import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SeasonOverview } from "../api/types";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import MorePage from "./MorePage";

const mocks = vi.hoisted(() => ({
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
  it("lists the league rows with the draft status under Players", () => {
    renderMore({ draftStatus: "unscheduled" });
    expect(screen.getByText("Your settings and commissioner settings")).toBeInTheDocument();
    expect(screen.getByText("Draft not scheduled")).toBeInTheDocument();
    expect(screen.getByText("How to play")).toBeInTheDocument();
    expect(screen.queryByText("Draft board")).not.toBeInTheDocument();
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
