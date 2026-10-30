import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateLeaguePage from "./CreateLeaguePage";

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("../api/client", () => ({ api: { get: mockGet, post: mockPost } }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));

// The wizard renders every scoring group, which is slow enough to hit 5s on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

const defaults = { scoring_passing_yard: 0.04, scoring_passing_td: 4 };

const onLeagueCreated = vi.fn().mockResolvedValue(undefined);

async function renderWizard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreateLeaguePage onLeagueCreated={onLeagueCreated} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
}

function chooseTeamUnits(qb: "On" | "Off", k: "On" | "Off") {
  const [qbGroup, kGroup] = screen.getAllByRole("radiogroup");
  fireEvent.click(
    within(qbGroup as HTMLElement).getByRole("radio", { name: new RegExp(`^${qb}`) }),
  );
  fireEvent.click(within(kGroup as HTMLElement).getByRole("radio", { name: new RegExp(`^${k}`) }));
}

async function openScoringStep() {
  await renderWizard();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  chooseTeamUnits("Off", "Off");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("CreateLeaguePage scoring step", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: defaults });
  });

  it("starts from the defaults served by the API", async () => {
    await openScoringStep();
    const yard = (await screen.findByLabelText("Yard", {
      selector: "#scoring-passing-yard",
    })) as HTMLInputElement;
    expect(yard.value).toBe("0.04");
  });

  it("restores defaults with the reset button", async () => {
    await openScoringStep();
    const td = (await screen.findByLabelText("TD", {
      selector: "#scoring-passing-td",
    })) as HTMLInputElement;
    fireEvent.change(td, { target: { value: "6" } });
    expect(td.value).toBe("6");

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    await waitFor(() => expect(td.value).toBe("4"));
  });
});

describe("CreateLeaguePage submit", () => {
  async function submitWizard() {
    await renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    chooseTeamUnits("On", "Off");
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: defaults });
    mockPost.mockReset();
    mockNavigate.mockReset();
    onLeagueCreated.mockClear();
  });

  it("refreshes the league list before navigating to the new league", async () => {
    mockPost.mockResolvedValue({ status: 201, data: { leagueId: 7 } });
    await submitWizard();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/league/7"));
    expect(onLeagueCreated).toHaveBeenCalledWith(7);
    expect(onLeagueCreated.mock.invocationCallOrder[0] ?? Number.NaN).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it("sends the explicit team QB and team K choices", async () => {
    mockPost.mockResolvedValue({ status: 201, data: { leagueId: 7 } });
    await submitWizard();
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0]?.[1]).toMatchObject({
      teamUnitSettings: { teamQb: true, teamK: false },
    });
  });

  it("stays on the wizard and shows an error when the request fails", async () => {
    mockPost.mockRejectedValue(new Error("boom"));
    await submitWizard();
    expect(await screen.findByText(/couldn.t create the league/i)).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(onLeagueCreated).not.toHaveBeenCalled();
  });
});

describe("CreateLeaguePage exhaustion warning", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: defaults });
  });

  it("starts at 6 teams with no warning, and warns at 8 teams with a cap of 2 kickers", async () => {
    await renderWizard();
    const teams = screen.getByLabelText("Teams") as HTMLInputElement;
    expect(teams.value).toBe("6");
    expect(screen.queryByText(/can run out/)).toBeNull();

    fireEvent.change(teams, { target: { value: "8" } });
    expect(screen.getAllByText(/8 teams × up to 2 K is 16/).length).toBeGreaterThan(0);
  });
});

describe("CreateLeaguePage team QB and team K", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: defaults });
  });

  it("makes the commissioner choose both before continuing, with nothing preselected", async () => {
    await renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const next = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    expect(next.disabled).toBe(true);

    const [qbGroup] = screen.getAllByRole("radiogroup");
    fireEvent.click(within(qbGroup as HTMLElement).getByRole("radio", { name: /^On/ }));
    expect(next.disabled).toBe(true);

    chooseTeamUnits("On", "Off");
    expect(next.disabled).toBe(false);
  });

  it("explains each rule in a tooltip that opens on tap", async () => {
    await renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.touchStart(screen.getByRole("button", { name: "About Team QB" }));
    expect(await screen.findByRole("tooltip")).toHaveProperty(
      "textContent",
      expect.stringMatching(/every QB on his NFL team/),
    );
  });
});
