import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateLeaguePage from "./CreateLeaguePage";

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({ default: { get: mockGet, post: vi.fn() } }));
vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({ getIdToken: vi.fn().mockResolvedValue("token") }),
}));

const defaults = { scoring_passing_yard: 0.04, scoring_passing_td: 4 };

async function openScoringStep() {
  render(
    <MemoryRouter>
      <CreateLeaguePage />
    </MemoryRouter>,
  );
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
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
