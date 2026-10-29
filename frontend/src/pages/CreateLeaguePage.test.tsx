import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateLeaguePage from "./CreateLeaguePage";

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({ default: { get: mockGet, post: mockPost } }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));
vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({ getIdToken: vi.fn().mockResolvedValue("token") }),
}));

const defaults = { scoring_passing_yard: 0.04, scoring_passing_td: 4 };

const onLeagueCreated = vi.fn().mockResolvedValue(undefined);

async function renderWizard() {
  render(
    <MemoryRouter>
      <CreateLeaguePage onLeagueCreated={onLeagueCreated} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
}

async function openScoringStep() {
  await renderWizard();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("CreateLeaguePage scoring step", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: defaults });
  });

  it("starts from the Sleeper defaults served by the API", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Reset to Sleeper defaults" }));
    await waitFor(() => expect(td.value).toBe("4"));
  });
});

describe("CreateLeaguePage submit", () => {
  async function submitWizard() {
    await renderWizard();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
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
    expect(onLeagueCreated.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0],
    );
  });

  it("stays on the wizard and shows an error when the request fails", async () => {
    mockPost.mockRejectedValue(new Error("boom"));
    await submitWizard();
    expect(await screen.findByText(/could not create the league/i)).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(onLeagueCreated).not.toHaveBeenCalled();
  });
});
