import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteLeagueDialog from "./DeleteLeagueDialog";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  error: null as unknown,
}));

vi.mock("../../api/queries", () => ({
  useDeleteLeague: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
    error: mocks.error,
  }),
}));

const renderDialog = (onClose = vi.fn()) =>
  render(
    <DeleteLeagueDialog leagueId={3} leagueName="Dynasty Bros" seasonCount={2} onClose={onClose} />,
  );

const next = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

beforeEach(() => {
  mocks.mutateAsync = vi.fn().mockResolvedValue(undefined);
  mocks.error = null;
});

describe("DeleteLeagueDialog", () => {
  it("warns that the delete is permanent and counts the seasons", () => {
    renderDialog();
    expect(screen.getByText(/permanent and cannot be undone/)).toBeInTheDocument();
    expect(screen.getByText(/both of its 2 seasons/)).toBeInTheDocument();
  });

  it("counts a single season in the singular", () => {
    render(<DeleteLeagueDialog leagueId={3} leagueName="Solo" seasonCount={1} onClose={vi.fn()} />);
    expect(screen.getByText(/its 1 season,/)).toBeInTheDocument();
  });

  it("needs the exact league name before the last step", () => {
    renderDialog();
    next();
    const input = screen.getByLabelText("League name");
    const proceed = screen.getByRole("button", { name: "Continue" });
    expect(proceed).toBeDisabled();
    fireEvent.change(input, { target: { value: "dynasty bros" } });
    expect(proceed).toBeDisabled();
    fireEvent.change(input, { target: { value: "Dynasty Bros" } });
    expect(proceed).toBeEnabled();
  });

  it("asks once more on its own screen, then deletes with the typed name", async () => {
    renderDialog();
    next();
    fireEvent.change(screen.getByLabelText("League name"), {
      target: { value: "Dynasty Bros" },
    });
    next();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete league forever" }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith("Dynasty Bros"));
  });

  it("can be cancelled at the first step without deleting", () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows why the server refused", () => {
    mocks.error = {
      response: { data: { detail: "End the draft in progress before deleting the league" } },
    };
    renderDialog();
    expect(
      screen.getByText("End the draft in progress before deleting the league"),
    ).toBeInTheDocument();
  });
});
