import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NameSetupDialog from "./NameSetupDialog";

const mocks = vi.hoisted(() => ({
  user: { email: "secret.person@example.com", user_metadata: {} } as unknown,
  needsNameSetup: true,
  updateDisplayName: vi.fn(),
  skipNameSetup: vi.fn(),
}));

vi.mock("../../contexts/UserContext", () => ({ useUser: () => mocks }));

beforeEach(() => {
  mocks.user = { email: "secret.person@example.com", user_metadata: {} };
  mocks.needsNameSetup = true;
  mocks.updateDisplayName.mockReset().mockResolvedValue(null);
  mocks.skipNameSetup.mockReset();
});

describe("NameSetupDialog", () => {
  it("is not shown once a name is set", () => {
    mocks.needsNameSetup = false;
    render(<NameSetupDialog />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts empty for an email sign-in: the email prefix is never offered", () => {
    render(<NameSetupDialog />);
    expect(screen.getByLabelText("Display name")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("is prefilled with the Google name", () => {
    mocks.user = { email: "a@b.co", user_metadata: { full_name: "Pat Jones" } };
    render(<NameSetupDialog />);
    expect(screen.getByLabelText("Display name")).toHaveValue("Pat Jones");
  });

  it("saves a trimmed name and can be skipped", async () => {
    render(<NameSetupDialog />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "  Coach  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updateDisplayName).toHaveBeenCalledWith("  Coach  "));
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(mocks.skipNameSetup).toHaveBeenCalled();
  });

  it("shows the problem for a whitespace-only name", () => {
    render(<NameSetupDialog />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
