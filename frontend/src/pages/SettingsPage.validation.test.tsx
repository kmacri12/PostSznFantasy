import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import SettingsPage from "./SettingsPage";

const mocks = vi.hoisted(() => ({
  standings: undefined as unknown,
  save: vi.fn(),
  // Stable: the page re-seeds its form state whenever this object changes identity.
  settings: {
    numberTeams: 6,
    rosterTotal: 3,
    rosterNumQb: 1,
    rosterNumBench: 2,
    scoringPassingTd: 4,
    multiplierWildCard: 1,
  },
}));

const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null };

vi.mock("../api/queries", () => ({
  useLeagueInfo: () => ({
    data: {
      id: 3,
      name: "L",
      notes: "",
      myRole: "commissioner",
      currentSeasonId: 5,
      seasons: [],
      members: [],
    },
  }),
  useLeagueSettings: () => ({ isLoading: false, isError: false, data: mocks.settings }),
  useDraft: () => ({ data: { status: "unscheduled" } }),
  useInvite: () => ({ data: { revoked: false } }),
  useStandings: () => ({ data: mocks.standings }),
  useSetAvatar: () => ({ ...mutation, reset: vi.fn() }),
  useUpdateLeague: () => mutation,
  useUpdateSeason: () => mutation,
  useUpdateSettings: () => ({ ...mutation, mutateAsync: mocks.save }),
}));
vi.mock("../contexts/UserContext", () => ({ useUser: () => ({ userId: 1 }) }));

const renderPage = () => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <SeasonContext.Provider
            value={testSeason({ canCommission: true, myRole: "commissioner" })}
          >
            <Link to="/elsewhere">Away</Link>
            <SettingsPage />
          </SeasonContext.Provider>
        ),
      },
    ],
    { initialEntries: ["/settings"] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

const editPassingTd = (value: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Scoring" }));
  const field = document.getElementById("scoring-passing-td") as HTMLElement;
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
};

beforeEach(() => {
  mocks.standings = undefined;
  mocks.save.mockReset().mockResolvedValue(undefined);
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("League settings validation", { timeout: 30000 }, () => {
  it("blocks Save and explains a cleared scoring field instead of saving 0", () => {
    renderPage();
    editPassingTd("");
    expect(screen.getByText(/^Required\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves a valid edit as a number", () => {
    renderPage();
    editPassingTd("6");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ scoring_passing_td: 6 }));
  });

  it("asks before re-scoring once games have been played", () => {
    mocks.standings = { phase: "live", round: 1, gamesFinal: 2, gamesInProgress: 0 };
    renderPage();
    editPassingTd("6");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText(/re-scores every team's finished rounds/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save and re-score" }));
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it("saves without a prompt before the draft, even with games on the schedule", () => {
    mocks.standings = { phase: "pre_draft", round: 1, gamesFinal: 2, gamesInProgress: 0 };
    renderPage();
    editPassingTd("6");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it("warns before navigating away with unsaved edits", async () => {
    const router = renderPage();
    editPassingTd("6");
    fireEvent.click(screen.getByRole("link", { name: "Away" }));
    expect(await screen.findByText("Leave without saving?")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(router.state.location.pathname).toBe("/settings");
  });
});
