import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteAccountDialog from "./DeleteAccountDialog";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), error: null as unknown }));

vi.mock("../../api/queries", () => ({
  useDeleteAccount: () => ({ mutate: mocks.mutate, isPending: false, error: mocks.error }),
}));

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.error = null;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

const type = (text: string) =>
  fireEvent.change(screen.getByLabelText("Confirmation"), { target: { value: text } });

describe("DeleteAccountDialog", () => {
  it("keeps the delete button disabled until DELETE is typed exactly", () => {
    render(<DeleteAccountDialog onDeleted={vi.fn()} onClose={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Delete my account" });
    expect(button).toBeDisabled();
    for (const wrong of ["", "delete", "DELET", "DELETE it", "yes"]) {
      type(wrong);
      expect(button).toBeDisabled();
    }
    type("  DELETE ");
    expect(button).toBeEnabled();
    expect(screen.getByText(/Ready: the button below/)).toBeInTheDocument();
  });

  it("explains what is deleted and what stays, sends the phrase and signs out", () => {
    const onDeleted = vi.fn();
    mocks.mutate.mockImplementation((_: unknown, options: { onSuccess: () => void }) =>
      options.onSuccess(),
    );
    render(<DeleteAccountDialog onDeleted={onDeleted} onClose={vi.fn()} />);
    expect(screen.getByText(/Former member/)).toBeInTheDocument();
    type("DELETE");
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(mocks.mutate).toHaveBeenCalledWith("DELETE", expect.anything());
    expect(onDeleted).toHaveBeenCalled();
  });

  it("does not delete on Enter unless the phrase matches", () => {
    render(<DeleteAccountDialog onDeleted={vi.fn()} onClose={vi.fn()} />);
    const field = screen.getByLabelText("Confirmation");
    type("nope");
    fireEvent.submit(field);
    expect(mocks.mutate).not.toHaveBeenCalled();
    type("DELETE");
    fireEvent.submit(field);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it("shows the API's reason, such as handing over a league first", () => {
    mocks.error = {
      response: { data: { detail: "Hand over commissioner to another member first in: Sunday" } },
    };
    render(<DeleteAccountDialog onDeleted={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/Hand over commissioner.*Sunday/)).toBeInTheDocument();
  });
});
