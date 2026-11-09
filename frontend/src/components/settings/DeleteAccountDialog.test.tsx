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

describe("DeleteAccountDialog", () => {
  it("explains what is deleted and what stays, and signs out after deleting", () => {
    const onDeleted = vi.fn();
    mocks.mutate.mockImplementation((_: unknown, options: { onSuccess: () => void }) =>
      options.onSuccess(),
    );
    render(<DeleteAccountDialog onDeleted={onDeleted} onClose={vi.fn()} />);
    expect(screen.getByText(/Former member/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(onDeleted).toHaveBeenCalled();
  });

  it("shows the API's reason, such as handing over a league first", () => {
    mocks.error = {
      response: { data: { detail: "Hand over commissioner to another member first in: Sunday" } },
    };
    render(<DeleteAccountDialog onDeleted={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/Hand over commissioner.*Sunday/)).toBeInTheDocument();
  });
});
