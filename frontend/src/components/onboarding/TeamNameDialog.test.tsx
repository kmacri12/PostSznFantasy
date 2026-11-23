import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamNameDialog from "./TeamNameDialog";

const mocks = vi.hoisted(() => ({
  teamName: "Team 3" as string | undefined,
  username: "Kyle Macri" as string | null,
  mutate: vi.fn(),
}));

vi.mock("../../api/queries", () => ({
  useTeam: () => ({ data: mocks.teamName === undefined ? undefined : { name: mocks.teamName } }),
  useRenameTeam: () => ({ mutate: mocks.mutate, isPending: false, isError: false, error: null }),
}));
vi.mock("../../contexts/UserContext", () => ({ useUser: () => ({ username: mocks.username }) }));

const open = vi.fn();
const show = () => render(<TeamNameDialog teamId={7} pending onOpenChange={open} />);

beforeEach(() => {
  localStorage.clear();
  mocks.teamName = "Team 3";
  mocks.username = "Kyle Macri";
  mocks.mutate.mockReset();
  open.mockReset();
});

describe("TeamNameDialog", () => {
  it("suggests the owner's first name for a bare Team N, and cannot be skipped", async () => {
    show();
    expect(await screen.findByLabelText("Team name")).toHaveValue("Team Kyle");
    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("starts from the name the API already gave the team", async () => {
    mocks.teamName = "Team Kyle 2";
    show();
    expect(await screen.findByLabelText("Team name")).toHaveValue("Team Kyle 2");
  });

  it("keeping the name closes without a request and remembers it was asked", async () => {
    mocks.teamName = "Team Kyle";
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(localStorage.getItem("postszn-team-name-prompted-7")).not.toBeNull();
  });

  it("saves a changed name, and is not marked as asked until it has been saved", async () => {
    show();
    fireEvent.change(await screen.findByLabelText("Team name"), {
      target: { value: "Gridiron Ghosts" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.mutate).toHaveBeenCalledWith("Gridiron Ghosts", expect.any(Object));
    expect(localStorage.getItem("postszn-team-name-prompted-7")).toBeNull();
  });
});
