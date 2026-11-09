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

// Customize rules renders every scoring group, which is slow enough to hit 5s on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

const defaults = { scoring_passing_yard: 0.04, scoring_passing_td: 4 };

async function renderWizard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreateLeaguePage />
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

const nameInput = () => screen.getByLabelText(/League name/) as HTMLInputElement;

async function openCustomize() {
  await renderWizard();
  fireEvent.change(nameInput(), { target: { value: "Pals" } });
  fireEvent.click(screen.getByRole("button", { name: "Customize rules" }));
}

async function openScoringStep() {
  await openCustomize();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: defaults });
  mockPost.mockReset();
  mockNavigate.mockReset();
});

describe("CreateLeaguePage short path", () => {
  it("asks only for a name and a team count, and needs the name", async () => {
    await renderWizard();
    const create = screen.getByRole("button", { name: "Create league" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(nameInput(), { target: { value: "Pals" } });
    expect(create.disabled).toBe(false);
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText(/Every round counts the same/)).toBeTruthy();
  });

  it("steps the team count within 2 to 14", async () => {
    await renderWizard();
    const fewer = screen.getByRole("button", { name: "Fewer teams" }) as HTMLButtonElement;
    for (let i = 0; i < 10; i++) fireEvent.click(fewer);
    expect(screen.getByRole("status").textContent).toBe("2");
    expect(fewer.disabled).toBe(true);
    const more = screen.getByRole("button", { name: "More teams" });
    for (let i = 0; i < 20; i++) fireEvent.click(more);
    expect(screen.getByRole("status").textContent).toBe("14");
  });

  it("creates with the defaults, team QB and K off, and opens the new league", async () => {
    mockPost.mockResolvedValue({ status: 201, data: { leagueId: 70, seasonId: 7 } });
    await renderWizard();
    fireEvent.change(nameInput(), { target: { value: "Pals" } });
    fireEvent.click(screen.getByRole("button", { name: "More teams" }));
    fireEvent.click(screen.getByRole("button", { name: "Create league" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/leagues/70", {
        state: { createdLeague: true },
      }),
    );
    const body = mockPost.mock.calls[0]?.[1];
    expect(body).toMatchObject({
      leagueName: "Pals",
      rosterSettings: { number_teams: 7 },
      teamUnitSettings: { teamQb: false, teamK: false },
    });
    expect(body).not.toHaveProperty("scoringSettings");
  });

  it("stays put and shows an error when the request fails", async () => {
    mockPost.mockRejectedValue(new Error("boom"));
    await renderWizard();
    fireEvent.change(nameInput(), { target: { value: "Pals" } });
    fireEvent.click(screen.getByRole("button", { name: "Create league" }));
    expect(await screen.findByText(/couldn.t create the league/i)).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("CreateLeaguePage customize rules", () => {
  it("shows both team QB and team K choices, off by default", async () => {
    await openCustomize();
    const [qbGroup, kGroup] = screen.getAllByRole("radiogroup");
    expect(within(qbGroup as HTMLElement).getByRole("radio", { name: /^Off/ })).toHaveProperty(
      "checked",
      true,
    );
    expect(within(kGroup as HTMLElement).getByRole("radio", { name: /^Off/ })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("goes back to the short form from the first step", async () => {
    await openCustomize();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Customize rules" })).toBeTruthy();
    expect(nameInput().value).toBe("Pals");
  });

  it("starts scoring from the defaults served by the API", async () => {
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

  it("sends the chosen team QB with the customised scoring", async () => {
    mockPost.mockResolvedValue({ status: 201, data: { leagueId: 70, seasonId: 7 } });
    await openCustomize();
    chooseTeamUnits("On", "Off");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByLabelText("TD", { selector: "#scoring-passing-td" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Create league" }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0]?.[1]).toMatchObject({
      leagueName: "Pals",
      scoringSettings: expect.any(Object),
      teamUnitSettings: { teamQb: true, teamK: false },
    });
  });

  it("explains each rule in a tooltip that opens on tap", async () => {
    await openCustomize();
    fireEvent.touchStart(screen.getByRole("button", { name: "About Team QB" }));
    expect(await screen.findByRole("tooltip")).toHaveProperty(
      "textContent",
      expect.stringMatching(/every QB on his NFL team/),
    );
  });

  it("warns at 8 teams with a cap of 2 kickers", async () => {
    await renderWizard();
    expect(screen.queryByText(/can run out/)).toBeNull();
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole("button", { name: "More teams" }));
    expect(screen.getAllByText(/8 teams × up to 2 K is 16/).length).toBeGreaterThan(0);
  });
});
